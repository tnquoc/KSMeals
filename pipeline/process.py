"""OCR pending posts and split them into per-day meals.

Reads posts to do from Supabase (raw_posts: pending, or failed on the LLM call),
downloads their images/documents, and writes back:
  menu_weeks  raw LLM output per post (re-split later without re-OCR)
  meals       one row per school/date/meal_type (+ tray photos)
  raw_posts   status -> published | needs_review | not_menu | failed

Usage: uv run python -m pipeline.process [--limit N] [--retry-review]
"""
import argparse
import asyncio
import re
import time
from datetime import date

from openai import APIConnectionError, InternalServerError, RateLimitError

from pipeline import config
from pipeline.crawl import fetch_contents
from pipeline.dates import DATE_RE, _make
from pipeline.fetch import Fetcher
from pipeline.ocr import extract_menu, make_client
from pipeline.split import build_meals
from pipeline.store import Store
from pipeline.survey import POST_RE

SINGLE_DATE_RE = re.compile(r"ngày\s*" + DATE_RE, re.I)


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


def interpret(post: dict, ocr: dict) -> tuple[list[dict], list[dict]]:
    """OCR output -> (meal rows, tray rows). Sets post status/error/kind."""
    published = date.fromisoformat(post["published_at"])
    if ocr.get("kind") == "tray_photo":
        post["kind"], post["status"], post["error"] = "tray", "published", None
        d = tray_date(post["title"], published)
        return [], [{"date": d.isoformat(), "meal_type": "lunch", "tray_image_urls": post["image_urls"]}]
    if ocr.get("kind") != "weekly_menu":
        post["status"], post["error"] = "not_menu", f"kind={ocr.get('kind')}"
        return [], []

    slug = POST_RE.search(post["url"]).group(2)
    rows, issues = build_meals(ocr, post["title"], slug, published)
    post["status"] = "needs_review" if issues else "published"
    post["error"] = "; ".join(issues) or None
    meals = [{"date": r["date"].isoformat(), "meal_type": r["meal_type"], "dishes": r["dishes"],
              "courses": r["courses"], "status": post["status"]} for r in rows]
    return meals, []


async def run(limit: int | None, retry_review: bool):
    store = Store()
    todo = store.todo_posts(retry_review)
    todo = todo[:limit] if limit else todo
    print(f"processing {len(todo)} posts with {config.LLM_MODEL}")

    client = make_client()
    counts: dict[str, int] = {}
    problems = []
    t = time.time()
    async with Fetcher(concurrency=2) as f:
        for i, post in enumerate(todo, 1):
            ocr, meals, trays = None, [], []
            images, text, file_error = await fetch_contents(f, post)
            if not images and not text:
                post["status"], post["error"] = "failed", file_error or "downloads failed"
            elif file_error and not file_error.startswith("legacy"):
                # The menu is usually in the attachment; OCR on the remaining (often decorative)
                # images would wrongly conclude "not a menu".
                post["status"], post["error"] = "failed", file_error
            else:
                try:
                    ocr = await asyncio.to_thread(call_with_backoff, lambda: extract_menu(
                        images, post["title"], post["published_at"], text=text, client=client))
                    meals, trays = interpret(post, ocr)
                except DailyQuotaExhausted as e:
                    print(f"daily LLM quota exhausted after {i - 1} posts; the rest stay pending.\n  {e}")
                    break
                except Exception as e:
                    post["status"], post["error"] = "failed", f"ocr: {type(e).__name__}: {str(e)[:200]}"
            # Persist after every post: LLM calls are the scarce resource, never redo them.
            store.finish_post(post, ocr, meals, trays)
            counts[post["status"]] = counts.get(post["status"], 0) + 1
            if post["status"] in ("needs_review", "failed"):
                problems.append(post)
            print(f"  {i}/{len(todo)} {post['status']:<12} {post['school_code']} {post['post_id']}", flush=True)

    print(f"done in {time.time() - t:.0f}s: {counts}")
    for p in problems:
        print(f"  {p['status']:<12} {p['school_code']:<28} {p['post_id']:<8} {(p['error'] or '')[:150]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--retry-review", action="store_true", help="re-OCR posts in needs_review too")
    args = ap.parse_args()
    asyncio.run(run(args.limit, args.retry_review))


if __name__ == "__main__":
    main()
