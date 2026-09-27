"""Morning menu reminders: one Web Push notification per subscribed browser, school days only.

"Trưa nay bé ăn gì?" with the day's lunch, plus a warning when a dish carries one of the
allergy groups the parent chose (from meals.dish_allergens, computed in code, never by the model).
Allergy terms parents typed themselves are only matched in the app, not here.

Needs VAPID_PRIVATE_KEY (and VAPID_SUBJECT, a mailto: or https: contact) in .env / Actions secrets.
Usage: uv run python -m pipeline.push [--date YYYY-MM-DD] [--dry-run]
"""
import argparse
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from pywebpush import WebPushException, webpush

from pipeline import config  # noqa: F401  (loads .env)
from pipeline.store import Store

VN = timezone(timedelta(hours=7))
WEB_URL = os.getenv("WEB_URL", "https://tnquoc.github.io/KSMeals").rstrip("/")
# Same ids and labels as pipeline/allergens.py and app/src/lib/labels.ts.
ALLERGEN = {
    "crustacean": "Tôm, cua", "mollusc": "Mực, sò", "fish": "Cá", "egg": "Trứng", "milk": "Sữa",
    "peanut": "Đậu phộng", "soy": "Đậu nành", "gluten": "Lúa mì", "sesame": "Mè", "tree_nut": "Hạt",
}
HEADLINE_COURSES = ["main", "stir_fry", "soup", "staple"]  # as in app/src/components/day-summary.tsx
MEAL_ORDER = ["breakfast", "morning_snack", "lunch", "snack"]


def headline(meal: dict) -> str:
    ranked = sorted((HEADLINE_COURSES.index(c), d) for d, c in zip(meal["dishes"], meal["courses"] or [])
                    if c in HEADLINE_COURSES)
    names = [d for _, d in ranked] or meal["dishes"]
    return " · ".join(names[:2])


def message(school_meals: list[dict], allergies: list[str]) -> dict | None:
    """Notification title/body for one subscriber, or None when the school posted nothing for the day."""
    with_dishes = [m for m in school_meals if m["dishes"]]
    if not with_dishes:
        return None
    lunch = next((m for m in with_dishes if m["meal_type"] == "lunch"), None)
    first = lunch or min(with_dishes, key=lambda m: MEAL_ORDER.index(m["meal_type"]))
    title = "Trưa nay bé ăn gì?" if lunch else "Hôm nay bé ăn gì ở trường?"
    body = headline(first)
    hits = sorted({a for m in with_dishes for tags in (m["dish_allergens"] or []) for a in tags if a in allergies}
                  | {a for m in with_dishes for a in (m["allergens"] or []) if a in allergies})
    if hits:
        body += f"\n⛔ Có món có thể chứa {', '.join(ALLERGEN.get(a, a) for a in hits)}"
    return {"title": title, "body": body}


def run(day: str, dry_run: bool):
    store = Store()
    subs = store.select("push_subscriptions", select="endpoint,p256dh,auth,school_id,allergies")
    if not subs:
        print("no subscribers")
        return
    school_ids = sorted({s["school_id"] for s in subs})
    meals = store.select("meals", select="school_id,meal_type,dishes,courses,allergens,dish_allergens",
                         status="eq.published", date=f"eq.{day}", school_id=f"in.({','.join(map(str, school_ids))})")
    codes = {s["id"]: s["code"] for s in store.select("schools", select="id,code", id=f"in.({','.join(map(str, school_ids))})")}
    by_school = defaultdict(list)
    for m in meals:
        by_school[m["school_id"]].append(m)

    key = os.getenv("VAPID_PRIVATE_KEY")
    if not key and not dry_run:
        raise SystemExit("Set VAPID_PRIVATE_KEY in .env / Actions secrets")
    claims = {"sub": os.getenv("VAPID_SUBJECT") or "mailto:noreply@ksmeals.app"}
    sent = skipped = gone = failed = 0
    for s in subs:
        msg = message(by_school.get(s["school_id"], []), s["allergies"] or [])
        if not msg:
            skipped += 1
            continue
        payload = {**msg, "url": f"{WEB_URL}/?school={codes.get(s['school_id'], '')}", "tag": f"menu-{day}"}
        if dry_run:
            print(f"  {codes.get(s['school_id'])}: {msg['title']} | {msg['body']!r}")
            sent += 1
            continue
        try:
            webpush({"endpoint": s["endpoint"], "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}},
                    json.dumps(payload, ensure_ascii=False), vapid_private_key=key, vapid_claims=dict(claims), ttl=4 * 3600)
            sent += 1
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):  # the browser dropped the subscription: forget it
                store.delete("push_subscriptions", {"endpoint": s["endpoint"]})
                gone += 1
            else:
                failed += 1
                print(f"  push failed ({status}): {str(e)[:150]}")
    print(f"{day}: {len(subs)} subscribers, {sent} sent, {skipped} without a menu today, {gone} expired, {failed} failed")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=datetime.now(VN).date().isoformat())
    ap.add_argument("--dry-run", action="store_true", help="print the messages, send nothing")
    args = ap.parse_args()
    run(args.date, args.dry_run)


if __name__ == "__main__":
    main()
