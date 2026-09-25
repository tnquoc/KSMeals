"""OCR pending posts and split them into per-day meals.

Reads data/raw_posts.jsonl (from crawl.py), writes:
  data/menu_weeks.jsonl  raw LLM output per post (re-split later without re-OCR)
  data/meals.jsonl       one row per school/date/meal_type
and updates each post's status to published | needs_review | not_menu | failed.

Usage: python -m pipeline.process [--limit N] [--retry-review]
"""
import argparse
import json
import re
import time
from datetime import date, datetime
from pathlib import Path

from openai import APIConnectionError, InternalServerError, RateLimitError

from pipeline import config
from pipeline.crawl import load_state, save_state
from pipeline.dates import DATE_RE, _make
from pipeline.ocr import extract_menu, make_client
from pipeline.split import build_meals
from pipeline.survey import POST_RE

WEEKS_FILE = config.DATA_DIR / "menu_weeks.jsonl"
MEALS_FILE = config.DATA_DIR / "meals.jsonl"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
SINGLE_DATE_RE = re.compile(r"ngày\s*" + DATE_RE, re.I)


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")


def tray_date(title: str, published: date) -> date:
    """Tray photo posts are titled like 'Suất ăn ngày 21/9/2026'; else use the post date."""
    m = SINGLE_DATE_RE.search(title or "")
    if m:
        d, mo, y = m.groups()
        got = _make(int(d), int(mo), int(y) if y else None, published)
        if got and abs((got - published).days) <= 7:
            return got
    return published


class DailyQuotaExhausted(Exception):
    pass


_last_call = 0.0


def call_with_backoff(fn, attempts: int = 5):
    """Space calls out for per-minute limits; wait on 503s; stop outright when the daily quota is gone."""
    global _last_call
    for attempt in range(attempts):
        wait = config.LLM_MIN_INTERVAL - (time.time() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.time()
        try:
            return fn()
        except RateLimitError as e:
            if "PerDay" in str(e):
                raise DailyQuotaExhausted(str(e)[:300]) from e
            error = e
        except (InternalServerError, APIConnectionError) as e:
            error = e
        if attempt == attempts - 1:
            raise error
        delay = 30 * (attempt + 1)
        print(f"    {type(error).__name__}, retrying in {delay}s", flush=True)
        time.sleep(delay)


def process_post(post: dict, client) -> tuple[dict | None, list[dict]]:
    """Returns (menu_week record, meal rows). Mutates post status/error."""
    files = [config.ROOT / p for p in post["local_files"]]
    images = [p.read_bytes() for p in files if p.suffix.lower() in IMAGE_EXTS]
    text = "\n\n".join(p.read_text(encoding="utf-8") for p in files if p.suffix == ".txt")
    published = datetime.fromisoformat(post["published_at"]).date()

    ocr = call_with_backoff(lambda: extract_menu(images, post["title"], published, text=text, client=client))
    week = {"school_code": post["school_code"], "post_id": post["post_id"], "model": config.LLM_MODEL,
            "json_raw": ocr, "created_at": datetime.now().isoformat(timespec="seconds")}

    if ocr.get("kind") == "tray_photo":
        post["kind"], post["status"], post["error"] = "tray", "published", None
        d = tray_date(post["title"], published)
        return week, [{"school_code": post["school_code"], "date": d.isoformat(), "meal_type": "lunch",
                       "tray_image_urls": post["image_urls"], "source_post_id": post["post_id"]}]
    if ocr.get("kind") != "weekly_menu":
        post["status"], post["error"] = "not_menu", f"kind={ocr.get('kind')}"
        return week, []

    slug = POST_RE.search(post["url"]).group(2)
    rows, issues = build_meals(ocr, post["title"], slug, published)
    post["status"] = "needs_review" if issues else "published"
    post["error"] = "; ".join(issues) or None
    meals = [{"school_code": post["school_code"], "date": r["date"].isoformat(), "meal_type": r["meal_type"],
              "dishes": r["dishes"], "courses": r["courses"], "source_post_id": post["post_id"],
              "status": post["status"]} for r in rows]
    return week, meals


def merge_meals(existing: list[dict], new: list[dict]) -> list[dict]:
    """Upsert on (school, date, meal_type). Tray photos attach to the menu row, not replace it."""
    by_key = {(m["school_code"], m["date"], m["meal_type"]): m for m in existing}
    for m in new:
        key = (m["school_code"], m["date"], m["meal_type"])
        if "tray_image_urls" in m and "dishes" not in m:
            by_key.setdefault(key, {"school_code": key[0], "date": key[1], "meal_type": key[2],
                                    "dishes": [], "courses": [], "status": "published"})
            by_key[key]["tray_image_urls"] = m["tray_image_urls"]
        else:
            tray = by_key.get(key, {}).get("tray_image_urls")
            by_key[key] = {**m, **({"tray_image_urls": tray} if tray else {})}
    return sorted(by_key.values(), key=lambda m: (m["school_code"], m["date"], m["meal_type"]))


def run(limit: int | None, retry_review: bool):
    state = load_state()
    todo_status = {"pending", "needs_review"} if retry_review else {"pending"}
    # Posts whose LLM call failed (quota, outage) are retried automatically.
    retryable = lambda p: p["status"] == "failed" and (p["error"] or "").startswith("ocr:")
    todo = [p for p in state.values() if (p["status"] in todo_status or retryable(p)) and p["local_files"]]
    todo = todo[:limit] if limit else todo
    print(f"processing {len(todo)} posts with {config.LLM_MODEL}")

    client = make_client()
    weeks = {(w["school_code"], w["post_id"]): w for w in read_jsonl(WEEKS_FILE)}
    meals = read_jsonl(MEALS_FILE)
    processed = []
    t = time.time()
    for i, post in enumerate(todo, 1):
        try:
            week, new_meals = process_post(post, client)
            weeks[(post["school_code"], post["post_id"])] = week
            meals = merge_meals(meals, new_meals)
        except DailyQuotaExhausted as e:
            print(f"daily LLM quota exhausted after {i - 1} posts; rerun tomorrow to continue.\n  {e}")
            break
        except Exception as e:
            post["status"], post["error"] = "failed", f"ocr: {type(e).__name__}: {str(e)[:200]}"
        processed.append(post)
        # Persist after every post: LLM calls are the scarce resource, never redo them.
        save_state(state)
        write_jsonl(WEEKS_FILE, list(weeks.values()))
        write_jsonl(MEALS_FILE, meals)
        print(f"  {i}/{len(todo)} {post['status']:<12} {post['school_code']} {post['post_id']}", flush=True)

    counts = {}
    for p in processed:
        counts[p["status"]] = counts.get(p["status"], 0) + 1
    print(f"done in {time.time() - t:.0f}s: {counts}")
    for p in processed:
        if p["status"] in ("needs_review", "failed"):
            print(f"  {p['status']:<12} {p['school_code']:<28} {p['post_id']:<8} {p['error'][:150]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--retry-review", action="store_true", help="re-OCR posts in needs_review too")
    args = ap.parse_args()
    run(args.limit, args.retry_review)


if __name__ == "__main__":
    main()
