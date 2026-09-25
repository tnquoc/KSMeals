"""Coverage survey: how many schools publish their meal menu, and how regularly.

One request per school: its sitemap.xml lists every post URL with a lastmod
date. robots.txt disallows /Timkiem (site search), so we don't use it.

Usage: python -m pipeline.survey [--schools data/schools.csv] [--out data/coverage.csv]
                                [--year-start 2026-08-24] [--limit N]
"""
import argparse
import asyncio
import csv
import re
from collections import Counter
from datetime import date
from pathlib import Path
from xml.etree import ElementTree

from pipeline.fetch import Fetcher, site_url

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# /<category-slug>/<post-slug>/(ct|ctmb|ctfull)/<category-id>/<post-id>
POST_RE = re.compile(r"/([^/]+)/([^/]+)/(?:ct|ctmb|ctfull)/(\d+)/(\d+)/?$")
MENU_POST_RE = re.compile(r"thuc-don|suat-an|bua-an|khau-phan-an")
MENU_CATEGORY_RE = re.compile(r"thuc-don|suat-an|bua-an")

REGULAR_MAX_GAP_DAYS = 14


def parse_sitemap(xml: str) -> tuple[list[tuple[str, date | None]], list[str]]:
    """Return (url entries with lastmod, child sitemap urls if this is an index)."""
    root = ElementTree.fromstring(xml.encode("utf-8"))
    children = [loc.text.strip() for loc in root.findall("sm:sitemap/sm:loc", NS)]
    entries = []
    for url in root.findall("sm:url", NS):
        loc = url.findtext("sm:loc", default="", namespaces=NS).strip()
        lastmod = url.findtext("sm:lastmod", default="", namespaces=NS).strip()
        try:
            d = date.fromisoformat(lastmod[:10]) if lastmod else None
        except ValueError:
            d = None
        entries.append((loc, d))
    return entries, children


def is_menu_post(url: str) -> bool:
    m = POST_RE.search(url)
    if not m:
        return False
    category_slug, post_slug = m.group(1), m.group(2)
    return bool(MENU_POST_RE.search(post_slug) or MENU_CATEGORY_RE.search(category_slug))


def post_id(url: str) -> str:
    return POST_RE.search(url).group(4)


def classify(menu_posts: list[tuple[str, date | None]], year_start: date, today: date) -> dict:
    dated = sorted((d, u) for u, d in menu_posts if d is not None)
    this_year = [(d, u) for d, u in dated if year_start <= d <= today]
    weeks = {d.isocalendar()[:2] for d, _ in this_year}
    last = dated[-1] if dated else None

    if not menu_posts:
        status = "none"
    elif not this_year:
        status = "stale"
    elif len(weeks) >= 2 and (today - this_year[-1][0]).days <= REGULAR_MAX_GAP_DAYS:
        status = "regular"
    else:
        status = "active"

    return {
        "status": status,
        "menu_posts_total": len(menu_posts),
        "menu_posts_this_year": len(this_year),
        "weeks_with_posts": len(weeks),
        "last_menu_date": last[0].isoformat() if last else "",
        "last_menu_url": last[1] if last else "",
    }


async def survey_school(f: Fetcher, school: dict, year_start: date, today: date) -> dict:
    xml = await f.get_text(site_url(school["code"], "/sitemap.xml"))
    if xml is None:
        return {**school, "status": "error", "error": "sitemap fetch failed"}
    try:
        entries, children = parse_sitemap(xml)
        for child in children:
            child_xml = await f.get_text(child)
            if child_xml:
                entries += parse_sitemap(child_xml)[0]
    except ElementTree.ParseError as e:
        return {**school, "status": "error", "error": f"bad sitemap: {e}"}

    # The same post can appear under several URL variants (ct/ctmb/ctfull).
    menu_posts = {}
    for url, d in entries:
        if is_menu_post(url):
            menu_posts.setdefault(post_id(url), (url, d))
    return {**school, **classify(list(menu_posts.values()), year_start, today), "error": ""}


async def run(schools: list[dict], year_start: date, today: date) -> list[dict]:
    async with Fetcher() as f:
        tasks = [survey_school(f, s, year_start, today) for s in schools]
        results = []
        for i, coro in enumerate(asyncio.as_completed(tasks), 1):
            results.append(await coro)
            if i % 100 == 0 or i == len(tasks):
                print(f"  {i}/{len(tasks)}", flush=True)
    return results


FIELDS = ["code", "name", "level", "ward", "status", "menu_posts_total", "menu_posts_this_year",
          "weeks_with_posts", "last_menu_date", "last_menu_url", "error"]
STATUSES = ["regular", "active", "stale", "none", "error"]


def print_summary(results: list[dict]):
    def row(label, rs):
        c = Counter(r["status"] for r in rs)
        ok = len(rs) - c["error"]
        pct = lambda n: f"{100 * n / ok:5.1f}%" if ok else "   - "
        cols = "  ".join(f"{s}={c[s]:<4}" for s in STATUSES)
        print(f"{label:<6} n={len(rs):<5} {cols}  regular {pct(c['regular'])}  regular+active {pct(c['regular'] + c['active'])}")

    print("\nstatus: regular = posted in >=2 weeks this school year and within the last "
          f"{REGULAR_MAX_GAP_DAYS} days; active = >=1 post this year; stale = only older posts")
    for level in ["mn", "th", "thcs"]:
        row(level, [r for r in results if r["level"] == level])
    row("all", results)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--schools", default="data/schools.csv")
    ap.add_argument("--out", default="data/coverage.csv")
    ap.add_argument("--year-start", default="2026-08-24", type=date.fromisoformat)
    ap.add_argument("--today", default=date.today().isoformat(), type=date.fromisoformat)
    ap.add_argument("--limit", type=int, help="survey only the first N schools")
    args = ap.parse_args()

    with open(args.schools, encoding="utf-8") as fh:
        schools = list(csv.DictReader(fh))
    if args.limit:
        schools = schools[: args.limit]
    print(f"surveying {len(schools)} schools")

    results = asyncio.run(run(schools, args.year_start, args.today))
    results.sort(key=lambda r: (r["ward"], r["level"], r["code"]))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(results)

    print_summary(results)
    print(f"\nwritten to {out}")


if __name__ == "__main__":
    main()
