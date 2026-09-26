"""Read each school's street address from its homepage footer into schools.address.

Footers look like "Địa chỉ: 322 Nguyễn Trọng Tuyển, Phường Tân Sơn Hòa, Thành phố Hồ Chí Minh
Điện thoại: ..." and sometimes list campuses ("CS1: ... CS2: ..."); we keep the first campus.

Usage: uv run python -m pipeline.addresses [--all] [--limit N]
       (default: schools without an address yet)
"""
import argparse
import asyncio
import html
import re

from pipeline.fetch import Fetcher, site_url
from pipeline.store import Store

ADDRESS_RE = re.compile(
    r"Địa\s*chỉ\s*:?\s*(.{8,160}?)\s*(?=Điện\s*thoại|ĐT\b|Email|E-mail|Hotline|Fax|Website|©|Copyright|Số\s*điện|$)",
    re.I,
)
CITY_SUFFIX_RE = re.compile(r",?\s*(?:(?:Thành\s*phố|TP\.?)\s*Hồ\s*Chí\s*Minh|TP\.?\s*HCM|TPHCM)\.?\s*$", re.I)


def parse_address(page: str) -> str | None:
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", page)))
    m = ADDRESS_RE.search(text)
    if not m:
        return None
    addr = m.group(1).strip(" :-–,.")
    addr = re.split(r"\s*CS\s*2\s*:", addr, flags=re.I)[0]          # first campus only
    addr = re.sub(r"^CS\s*1\s*:\s*", "", addr, flags=re.I)
    addr = CITY_SUFFIX_RE.sub("", addr).strip(" ,.")
    # Needs a house number or a street-like word to count as an address.
    if len(addr) < 8 or not re.search(r"\d|đường|phường|xã|ấp|khu phố", addr, re.I):
        return None
    return addr[:120]


async def run(codes: list[str]) -> dict[str, str | None]:
    async with Fetcher(concurrency=3) as f:
        pages = await asyncio.gather(*(f.get_text(site_url(c)) for c in codes))
    return {c: parse_address(p) if p else None for c, p in zip(codes, pages)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="refresh every school, not only missing ones")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    store = Store()
    schools = store.select("schools", select="id,code,address", order="active.desc,code")
    todo = [s for s in schools if args.all or not s["address"]]
    todo = todo[: args.limit] if args.limit else todo
    print(f"reading addresses for {len(todo)} schools")
    found = asyncio.run(run([s["code"] for s in todo]))
    ids = {s["code"]: s["id"] for s in todo}
    hits = 0
    for code, addr in found.items():
        if addr:
            store.update("schools", {"id": ids[code]}, {"address": addr})
            hits += 1
    print(f"addresses found: {hits}/{len(todo)}")


if __name__ == "__main__":
    main()
