"""Build the list of public schools in HCMC from the ward portals.

Every ward/commune portal (phuong*.hcm.edu.vn, xa*.hcm.edu.vn, dackhu*) links
to all other ward portals, and its top nav lists the schools in that ward,
grouped by level via `dsdonvi.aspx?codekhoi=mn|th|thcs`.

Usage: uv run python -m pipeline.discover [--seed phuongtansonhoa] [--out data/schools.csv]
"""
import argparse
import asyncio
import csv
import re
from pathlib import Path

from bs4 import BeautifulSoup

from pipeline.fetch import Fetcher, site_url

SUBDOMAIN_RE = re.compile(r"https?://([a-z0-9-]+)\.hcm\.edu\.vn", re.I)
WARD_RE = re.compile(r"^(phuong|xa|dackhu)[a-z0-9]+$")
LEVEL_RE = re.compile(r"codekhoi=(mn|th|thcs)\b")


def parse_ward_codes(html: str) -> set[str]:
    return {c.lower() for c in SUBDOMAIN_RE.findall(html) if WARD_RE.match(c.lower())}


def parse_schools(html: str, ward: str) -> list[dict]:
    """Extract schools from the ward portal nav: one dropdown per school level."""
    soup = BeautifulSoup(html, "lxml")
    schools = []
    for header in soup.find_all("a", href=LEVEL_RE):
        level = LEVEL_RE.search(header["href"]).group(1)
        dropdown = header.find_next_sibling("div")
        if dropdown is None:
            continue
        for a in dropdown.find_all("a", href=SUBDOMAIN_RE):
            code = SUBDOMAIN_RE.search(a["href"]).group(1).lower()
            if WARD_RE.match(code):
                continue
            schools.append({
                "code": code,
                "name": " ".join(a.get_text().split()),
                "level": level,
                "ward": ward,
            })
    return schools


async def discover(seed: str) -> tuple[list[str], list[dict], list[str]]:
    async with Fetcher() as f:
        seed_html = await f.get_text(site_url(seed))
        if seed_html is None:
            raise SystemExit(f"Could not fetch seed ward portal: {seed}")
        wards = sorted(parse_ward_codes(seed_html) | {seed})

        pages = await asyncio.gather(*(f.get_text(site_url(w)) for w in wards))

    schools: dict[str, dict] = {}
    failed = []
    for ward, html in zip(wards, pages):
        if html is None:
            failed.append(ward)
            continue
        for s in parse_schools(html, ward):
            schools.setdefault(s["code"], s)
    return wards, sorted(schools.values(), key=lambda s: (s["ward"], s["level"], s["code"])), failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", default="phuongtansonhoa")
    ap.add_argument("--out", default="data/schools.csv")
    args = ap.parse_args()

    wards, schools, failed = asyncio.run(discover(args.seed))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["code", "name", "level", "ward"])
        w.writeheader()
        w.writerows(schools)

    by_level: dict[str, int] = {}
    for s in schools:
        by_level[s["level"]] = by_level.get(s["level"], 0) + 1
    print(f"wards: {len(wards)} ({len(failed)} failed: {', '.join(failed) or '-'})")
    print(f"schools: {len(schools)} {by_level}")
    print(f"written to {out}")


if __name__ == "__main__":
    main()
