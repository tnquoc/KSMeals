"""Crawl recent menu posts: sitemap -> new menu posts -> post page -> image/document URLs.

Menus come as body images, or attached PDF/Word/Excel files. PDFs are rendered to
page images; .docx/.xlsx are converted to text. Legacy .doc/.xls are skipped for now.

Only records new posts (status pending) in Supabase; downloading and OCR happen in
process.py, so a run that stops early can resume anywhere from the database alone.

Usage: uv run python -m pipeline.crawl [--schools code1 code2 ... | --tracked | --active-only | --status regular active]
                                       [--since-days 14]
"""
import argparse
import asyncio
import csv
import io
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote

from bs4 import BeautifulSoup

from pipeline import config
from pipeline.fetch import Fetcher, site_url
from pipeline.store import Store
from pipeline.survey import POST_RE, is_menu_post, parse_sitemap, post_id

PUBLISHED_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4}),?\s*(\d{1,2}):(\d{2})")
TRAY_SLUG_RE = re.compile(r"khay-an|hinh-anh|bua-an")
IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.I)
IMG_SRC_RE = re.compile(r'src="(https?://file\w*\.hcm\.shieldix\.app/(uploadimages/(?:news|haydung)|data/doc)/[^"]+)"', re.I)
# Attachments, also found url-encoded inside Office viewer iframes.
DOC_RE = re.compile(r"https?://file\w*\.hcm\.shieldix\.app/data/doc/[^\"'&<>\s]+?\.(?:pdf|docx?|xlsx?)", re.I)
# The related-posts list after the article uses these thumbnail classes.
RELATED_MARKERS = ('class="item-ratio"', 'class="item_hint', 'class="line-5 big_item_news')
MAX_PDF_PAGES = 4


def full_size(url: str) -> str:
    """CDN resizes with ?w=...; the original is much better for OCR."""
    return re.sub(r"\?w=\d+$", "", url.strip())


def article_html(html: str, title: str) -> str:
    """Slice from the article title to the related-posts list, so sidebars don't leak in."""
    body_start = max(html.find("<body"), 0)
    start = html.find(title, body_start) if title else -1
    start = html.rfind("<h1", body_start, start) if start >= 0 else html.find("<h1", body_start)
    start = max(start, body_start)
    ends = [i for i in (html.find(m, start) for m in RELATED_MARKERS) if i >= 0]
    return html[start: min(ends) if ends else len(html)]


def parse_post(html: str, url: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    og = soup.find("meta", property="og:title")
    h1s = soup.find_all("h1")
    title = " ".join((og.get("content") if og else (h1s[-1].get_text() if h1s else "")).split())

    body = article_html(html, title)
    published = None
    m = PUBLISHED_RE.search(body)
    if m:
        d, mo, y, hh, mm = map(int, m.groups())
        published = datetime(y, mo, d, hh, mm)

    images = []
    for tag in IMG_TAG_RE.findall(body):
        m = IMG_SRC_RE.search(tag)
        if not m:
            continue
        # The shared image library ("haydung") also holds logos and generic
        # featured images; only trust it for images placed in the article text.
        if m.group(2).lower().endswith("haydung") and "anhnoidung" not in tag:
            continue
        if full_size(m.group(1)) not in images:
            images.append(full_size(m.group(1)))

    docs = []
    for u in DOC_RE.findall(unquote(body)):
        if u not in docs:
            docs.append(u)

    slug = POST_RE.search(url).group(2)
    kind = "tray" if TRAY_SLUG_RE.search(slug) and "thuc-don" not in slug else "menu"
    return {"title": title, "published_at": published.isoformat() if published else None,
            "image_urls": images, "doc_urls": docs, "kind": kind}


def docx_to_text(data: bytes) -> str:
    import docx

    d = docx.Document(io.BytesIO(data))
    lines = [p.text for p in d.paragraphs if p.text.strip()]
    for t in d.tables:
        for row in t.rows:
            cells = []
            for c in row.cells:  # merged cells repeat; keep one copy
                text = " ".join(c.text.split())
                if not cells or cells[-1] != text:
                    cells.append(text)
            lines.append(" | ".join(cells))
    return "\n".join(lines)


def xlsx_to_text(data: bytes) -> str:
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    lines = []
    for ws in wb.worksheets[:3]:
        lines.append(f"# sheet {ws.title}")
        for row in ws.iter_rows(values_only=True):
            cells = [" ".join(str(v).split()) for v in row if v is not None and str(v).strip()]
            if cells:
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def pdf_to_images(data: bytes) -> list[bytes]:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(data)
    pages = []
    for i in range(min(len(pdf), MAX_PDF_PAGES)):
        buf = io.BytesIO()
        pdf[i].render(scale=2).to_pil().save(buf, format="PNG")
        pages.append(buf.getvalue())
    return pages


async def fetch_contents(f: Fetcher, post: dict) -> tuple[list[bytes], str, str | None]:
    """Download a post's media for the LLM: (images incl. rendered PDF pages, document text, error)."""
    images, texts, error = [], [], None
    for url in post["image_urls"]:
        data = await f.get_bytes(url)
        if data:
            images.append(data)
    for url in post["doc_urls"]:
        ext = Path(url).suffix.lower()
        if ext in (".doc", ".xls"):
            error = f"legacy {ext} not supported yet"
            continue
        data = await f.get_bytes(url)
        if not data:
            continue
        try:
            if ext == ".pdf":
                images += pdf_to_images(data)
            else:
                texts.append(docx_to_text(data) if ext == ".docx" else xlsx_to_text(data))
        except Exception as e:  # corrupt or encrypted file
            error = f"{ext} read failed: {e}"
    return images, "\n\n".join(texts), error


async def crawl_school(f: Fetcher, code: str, since: date, known: set) -> list[dict]:
    xml = await f.get_text(site_url(code, "/sitemap.xml"))
    if xml is None:
        print(f"  {code}: sitemap failed")
        return []
    entries, _ = parse_sitemap(xml)
    new = {}
    for url, lastmod in entries:
        if is_menu_post(url) and lastmod and lastmod >= since:
            pid = post_id(url)
            if (code, pid) not in known:
                new.setdefault(pid, (url, lastmod))

    posts = []
    for pid, (url, lastmod) in new.items():
        html = await f.get_text(url)
        if html is None:
            continue
        post = {"school_code": code, "post_id": pid, "url": url, **parse_post(html, url),
                "status": "pending", "error": None}
        post["published_at"] = post["published_at"] or lastmod.isoformat()
        if not post["image_urls"] and not post["doc_urls"]:
            post["status"], post["error"] = "failed", "no images or documents in post"
        posts.append(post)
    return posts


TRACKED_FILE = config.DATA_DIR / "tracked_schools.txt"


def tracked_codes() -> list[str]:
    lines = TRACKED_FILE.read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.startswith("#")]


def pick_schools(status: list[str]) -> list[str]:
    with open(config.DATA_DIR / "coverage.csv", encoding="utf-8") as fh:
        return [r["code"] for r in csv.DictReader(fh) if r["status"] in status]


async def run(codes: list[str], since: date) -> list[dict]:
    store = Store()
    known = store.known_posts(codes)
    new_posts = []

    async def one(code):
        posts = await crawl_school(f, code, since, known)
        if posts:
            store.save_posts(posts)  # per school, so an interrupted crawl keeps its progress
            new_posts.extend(posts)

    async with Fetcher(concurrency=2) as f:
        await asyncio.gather(*(one(c) for c in codes))
    return new_posts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--schools", nargs="*", help="school codes (default: from coverage.csv)")
    ap.add_argument("--status", nargs="*", default=["regular", "active"])
    ap.add_argument("--active-only", action="store_true", help="only schools already shown in the app")
    ap.add_argument("--tracked", action="store_true", help=f"schools listed in {TRACKED_FILE.name}")
    ap.add_argument("--since-days", type=int, default=14)
    args = ap.parse_args()

    if args.schools:
        codes = args.schools
    elif args.tracked:
        codes = tracked_codes()
    elif args.active_only:
        codes = Store().active_codes()
    else:
        codes = pick_schools(args.status)
    since = date.today() - timedelta(days=args.since_days)
    print(f"crawling {len(codes)} schools, menu posts since {since}")
    posts = asyncio.run(run(codes, since))

    by_status = {}
    for p in posts:
        by_status[p["status"]] = by_status.get(p["status"], 0) + 1
    n_doc = sum(1 for p in posts if p["doc_urls"])
    print(f"new posts: {len(posts)} {by_status}; with documents: {n_doc}; tray: {sum(p['kind'] == 'tray' for p in posts)}")


if __name__ == "__main__":
    main()
