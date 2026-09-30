"""Usage report from the anonymous `events` table (migration 0008).

The number that matters for v1: how many devices open KSMeals on 3+ days a week.

Usage: uv run python -m pipeline.stats [--days 14]
"""
import argparse
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from pipeline.store import Store

VN = timezone(timedelta(hours=7))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14)
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # school names on a Windows console

    store = Store()
    since = datetime.now(VN) - timedelta(days=args.days)
    rows = store.select("events", select="device_id,name,school_code,platform,props,created_at",
                        created_at=f"gte.{since.isoformat()}", order="created_at")
    if not rows:
        print(f"no events in the last {args.days} days")
        return
    names = {s["code"]: s["name"] for s in store.select("schools", select="code,name")}

    # Crawlers and link previews that run the web app are flagged on app_open (props.bot): drop devices
    # that were only ever seen as a bot (a real browser can be flagged once, e.g. by a preview, then used).
    opens = [r for r in rows if r["name"] == "app_open"]
    bots = ({r["device_id"] for r in opens if (r["props"] or {}).get("bot")}
            - {r["device_id"] for r in opens if not (r["props"] or {}).get("bot")})
    rows = [r for r in rows if r["device_id"] not in bots]
    if bots:
        print(f"(skipped {len(bots)} bot devices)")

    for r in rows:
        r["day"] = datetime.fromisoformat(r["created_at"]).astimezone(VN).date()
    today = datetime.now(VN).date()
    days_by_device = defaultdict(set)
    for r in rows:
        days_by_device[r["device_id"]].add(r["day"])

    print(f"== last {args.days} days: {len(rows)} events from {len(days_by_device)} devices\n")

    print("Daily active devices")
    per_day = defaultdict(set)
    for r in rows:
        per_day[r["day"]].add(r["device_id"])
    for d in sorted(per_day):
        print(f"  {d:%a %d/%m}  {len(per_day[d]):>4}  {'#' * min(len(per_day[d]), 60)}")

    week = {today - timedelta(days=i) for i in range(7)}
    active_week = {dev: len(ds & week) for dev, ds in days_by_device.items() if ds & week}
    regular = sum(1 for n in active_week.values() if n >= 3)
    print(f"\nLast 7 days: {len(active_week)} active devices, "
          f"{regular} opened KSMeals on 3+ days ({100 * regular / max(len(active_week), 1):.0f}%)  <- key metric")

    first_seen = {dev: min(ds) for dev, ds in days_by_device.items()}
    came_back = sum(1 for dev, ds in days_by_device.items() if len(ds) > 1)
    print(f"Came back on another day: {came_back}/{len(first_seen)} devices")

    print("\nFeatures (events / devices)")
    by_name = defaultdict(list)
    for r in rows:
        by_name[r["name"]].append(r["device_id"])
    for name, devs in sorted(by_name.items(), key=lambda kv: -len(set(kv[1]))):
        print(f"  {name:<18} {len(devs):>5} / {len(set(devs)):>4}")

    print("\nSchools (devices)")
    school_devs = defaultdict(set)
    for r in rows:
        if r["school_code"]:
            school_devs[r["school_code"]].add(r["device_id"])
    for code, devs in sorted(school_devs.items(), key=lambda kv: -len(kv[1]))[:15]:
        print(f"  {len(devs):>4}  {names.get(code, code)}")

    print("\nWhere devices came from (their first app_open in this window; '?' = before sources were recorded)")
    first_open = {}
    for r in rows:
        if r["name"] == "app_open" and r["device_id"] not in first_open:
            first_open[r["device_id"]] = r
    with_school = {r["device_id"] for r in rows if r["school_code"]}
    by_source = defaultdict(list)
    for dev, r in first_open.items():
        p = r["props"] or {}
        by_source[p.get("ref", "?") + (f" [{p['src']}]" if p.get("src") else "")].append(dev)
    print(f"  {'source':<24} {'devs':>4} {'school':>7} {'back':>5}")
    for src, devs in sorted(by_source.items(), key=lambda kv: -len(kv[1])):
        school = sum(1 for d in devs if d in with_school)
        back = sum(1 for d in devs if len(days_by_device[d]) > 1)
        print(f"  {src:<24} {len(devs):>4} {school:>7} {back:>5}")

    platforms = Counter(r["platform"] for r in rows if r["name"] == "app_open")
    print("\nPlatforms (app opens):", dict(platforms))
    shares = [r for r in rows if r["name"] == "share"]
    linked = sum(1 for r in rows if r["name"] == "school_selected" and (r["props"] or {}).get("from") == "link")
    print(f"Shares: {len(shares)} | schools opened from a shared link: {linked}")


if __name__ == "__main__":
    main()
