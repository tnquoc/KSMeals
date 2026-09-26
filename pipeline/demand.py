"""Which unsupported schools parents asked for ("Báo tôi khi có"), and whether we can cover them.

A requested school is worth adding when its website posts menus (coverage status from survey.py:
regular or active). --add appends those to data/tracked_schools.txt so the daily pipeline crawls them.

Usage: uv run python -m pipeline.demand [--top 30] [--add]
"""
import argparse
from collections import Counter

from pipeline.crawl import TRACKED_FILE, tracked_codes
from pipeline.store import Store

COVERABLE = {"regular", "active"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=30)
    ap.add_argument("--add", action="store_true", help="track requested schools whose websites post menus")
    args = ap.parse_args()

    store = Store()
    counts = Counter(r["school_code"] for r in store.select("school_requests", select="school_code"))
    if not counts:
        print("no requests yet")
        return
    schools = {s["code"]: s for s in store.select("schools", select="code,name,ward,coverage_status,last_menu_date,active")}
    tracked = set(tracked_codes())

    print(f"{sum(counts.values())} requests for {len(counts)} schools\n")
    print(f"{'requests':>8}  {'posts menus?':<13} {'tracked':<8} school")
    to_add = []
    for code, n in counts.most_common(args.top):
        s = schools.get(code, {})
        status = s.get("coverage_status") or "?"
        is_tracked = code in tracked
        if status in COVERABLE and not is_tracked:
            to_add.append(code)
        print(f"{n:>8}  {status:<13} {'yes' if is_tracked else '-':<8} {s.get('name', code)} ({s.get('ward', '')})")

    if args.add and to_add:
        with TRACKED_FILE.open("a", encoding="utf-8") as fh:
            fh.writelines(f"{code}\n" for code in to_add)
        print(f"\nadded {len(to_add)} schools to {TRACKED_FILE.name}; commit it so the daily run crawls them")
    elif to_add:
        print(f"\n{len(to_add)} requested schools post menus and are not tracked yet: rerun with --add")


if __name__ == "__main__":
    main()
