"""Push local pipeline output (data/*.csv, data/*.jsonl) to Supabase via its REST API.

Uses the secret (service role) key, which bypasses row level security. Every write
is an upsert on the table's natural key, so re-running is safe.

Usage: python -m pipeline.sync
"""
import csv
import json

import httpx

from pipeline import config
from pipeline.crawl import load_state
from pipeline.process import MEALS_FILE, WEEKS_FILE, read_jsonl

BATCH = 500


class Supabase:
    def __init__(self, url: str, key: str):
        if not url or not key:
            raise SystemExit("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env")
        headers = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):  # legacy service_role JWT
            headers["Authorization"] = f"Bearer {key}"
        self.http = httpx.Client(base_url=f"{url.rstrip('/')}/rest/v1", headers=headers, timeout=60)

    def upsert(self, table: str, rows: list[dict], on_conflict: str, returning: str = "") -> list[dict]:
        out = []
        for i in range(0, len(rows), BATCH):
            prefer = "resolution=merge-duplicates," + ("return=representation" if returning else "return=minimal")
            resp = self.http.post(
                f"/{table}",
                params={"on_conflict": on_conflict, **({"select": returning} if returning else {})},
                headers={"Prefer": prefer},
                content=json.dumps(rows[i: i + BATCH], ensure_ascii=False, default=str),
            )
            if resp.status_code >= 300:
                raise SystemExit(f"{table}: {resp.status_code} {resp.text[:500]}")
            if returning:
                out += resp.json()
        return out


def main():
    db = Supabase(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY)

    meals = read_jsonl(MEALS_FILE)
    with_meals = {m["school_code"] for m in meals if m.get("status") == "published"}
    with open(config.DATA_DIR / "coverage.csv", encoding="utf-8") as fh:
        schools = [{
            "code": r["code"], "name": r["name"], "level": r["level"], "ward": r["ward"],
            "coverage_status": r["status"], "last_menu_date": r["last_menu_date"] or None,
            "active": r["code"] in with_meals,
        } for r in csv.DictReader(fh)]
    school_ids = {r["code"]: r["id"] for r in db.upsert("schools", schools, "code", "id,code")}
    print(f"schools: {len(school_ids)} ({len(with_meals)} active)")

    posts = [p for p in load_state().values() if p["school_code"] in school_ids]
    post_rows = [{
        "school_id": school_ids[p["school_code"]], "post_id": p["post_id"], "kind": p["kind"],
        "url": p["url"], "title": p["title"], "published_at": (p["published_at"] or "")[:10] or None,
        "image_urls": p["image_urls"] + p.get("doc_urls", []), "status": p["status"],
        "error": p["error"], "crawled_at": p["crawled_at"],
    } for p in posts]
    got = db.upsert("raw_posts", post_rows, "school_id,post_id", "id,school_id,post_id")
    code_by_id = {v: k for k, v in school_ids.items()}
    post_ids = {(code_by_id[r["school_id"]], r["post_id"]): r["id"] for r in got}
    print(f"raw_posts: {len(post_ids)}")

    weeks = [{
        "raw_post_id": post_ids[(w["school_code"], w["post_id"])],
        "week_start": w["json_raw"].get("week_start"), "week_end": w["json_raw"].get("week_end"),
        "json_raw": w["json_raw"], "model": w["model"],
    } for w in read_jsonl(WEEKS_FILE) if (w["school_code"], w["post_id"]) in post_ids]
    db.upsert("menu_weeks", weeks, "raw_post_id")
    print(f"menu_weeks: {len(weeks)}")

    meal_rows = [{
        "school_id": school_ids[m["school_code"]], "date": m["date"], "meal_type": m["meal_type"],
        "dishes": m.get("dishes", []), "courses": m.get("courses", []),
        "tray_image_urls": m.get("tray_image_urls", []),
        "source_post_id": post_ids.get((m["school_code"], m.get("source_post_id"))),
        "status": m.get("status", "published"),
    } for m in meals if m["school_code"] in school_ids]
    db.upsert("meals", meal_rows, "school_id,date,meal_type")
    print(f"meals: {len(meal_rows)}")


if __name__ == "__main__":
    main()
