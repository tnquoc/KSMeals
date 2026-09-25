"""Supabase as the pipeline's state store (PostgREST over HTTP, secret key).

Every write is an upsert on the table's natural key, so re-running any step is safe.
"""
import json

import httpx

from pipeline import config

BATCH = 500
PAGE = 1000


class Store:
    def __init__(self, url: str = config.SUPABASE_URL, key: str = config.SUPABASE_SECRET_KEY):
        if not url or not key:
            raise SystemExit("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env")
        headers = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):  # legacy service_role JWT
            headers["Authorization"] = f"Bearer {key}"
        self.http = httpx.Client(base_url=f"{url}/rest/v1", headers=headers, timeout=60)
        self._school_ids: dict[str, int] | None = None

    # -- low level -------------------------------------------------------

    def select(self, table: str, **params) -> list[dict]:
        """GET with automatic paging (PostgREST caps each response)."""
        rows, offset = [], 0
        while True:
            resp = self.http.get(f"/{table}", params=params,
                                 headers={"Range-Unit": "items", "Range": f"{offset}-{offset + PAGE - 1}"})
            self._check(table, resp)
            batch = resp.json()
            rows += batch
            if len(batch) < PAGE:
                return rows
            offset += PAGE

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
            self._check(table, resp)
            if returning:
                out += resp.json()
        return out

    def update(self, table: str, match: dict, values: dict):
        params = {k: f"eq.{v}" for k, v in match.items()}
        resp = self.http.patch(f"/{table}", params=params, content=json.dumps(values, ensure_ascii=False, default=str))
        self._check(table, resp)

    @staticmethod
    def _check(table: str, resp: httpx.Response):
        if resp.status_code >= 300:
            raise RuntimeError(f"supabase {table}: {resp.status_code} {resp.text[:500]}")

    # -- pipeline helpers --------------------------------------------------

    def school_ids(self) -> dict[str, int]:
        if self._school_ids is None:
            self._school_ids = {r["code"]: r["id"] for r in self.select("schools", select="id,code")}
        return self._school_ids

    def active_codes(self) -> list[str]:
        return [r["code"] for r in self.select("schools", select="code", active="eq.true")]

    def known_posts(self, codes: list[str]) -> set[tuple[str, str]]:
        ids = self.school_ids()
        wanted = {ids[c] for c in codes if c in ids}
        code_by_id = {v: k for k, v in ids.items()}
        rows = self.select("raw_posts", select="school_id,post_id")
        return {(code_by_id[r["school_id"]], r["post_id"]) for r in rows if r["school_id"] in wanted}

    def save_posts(self, posts: list[dict]):
        ids = self.school_ids()
        rows = [{
            "school_id": ids[p["school_code"]], "post_id": p["post_id"], "kind": p["kind"], "url": p["url"],
            "title": p["title"], "published_at": (p["published_at"] or "")[:10] or None,
            "image_urls": p["image_urls"], "doc_urls": p["doc_urls"], "status": p["status"], "error": p["error"],
        } for p in posts]
        self.upsert("raw_posts", rows, "school_id,post_id")

    def todo_posts(self, retry_review: bool = False) -> list[dict]:
        """Pending posts, plus ones whose LLM call failed (quota/outage), oldest first."""
        statuses = "pending,needs_review" if retry_review else "pending"
        rows = self.select(
            "raw_posts", select="*,schools(code)", order="published_at.asc",
            **{"or": f"(status.in.({statuses}),and(status.eq.failed,error.like.ocr:*))"},
        )
        for r in rows:
            r["school_code"] = r.pop("schools")["code"]
        return rows

    def finish_post(self, post: dict, ocr: dict | None, meals: list[dict], trays: list[dict]):
        """Store one processed post: OCR output, meal rows, tray photos, and the post's new status."""
        if ocr is not None:
            self.upsert("menu_weeks", [{
                "raw_post_id": post["id"], "week_start": ocr.get("week_start"), "week_end": ocr.get("week_end"),
                "json_raw": ocr, "model": config.LLM_MODEL,
            }], "raw_post_id")
        sid = post["school_id"]
        if meals:
            # No tray_image_urls in the payload: an existing row keeps its photos.
            self.upsert("meals", [{
                "school_id": sid, "date": m["date"], "meal_type": m["meal_type"], "dishes": m["dishes"],
                "courses": m["courses"], "source_post_id": post["id"], "status": m["status"],
            } for m in meals], "school_id,date,meal_type")
        if trays:
            # Only tray_image_urls: an existing menu row keeps its dishes.
            self.upsert("meals", [{
                "school_id": sid, "date": t["date"], "meal_type": t["meal_type"],
                "tray_image_urls": t["tray_image_urls"],
            } for t in trays], "school_id,date,meal_type")
        self.update("raw_posts", {"id": post["id"]},
                    {"status": post["status"], "error": post["error"], "kind": post["kind"]})
        if post["status"] == "published" and (meals or trays):
            self.update("schools", {"id": sid}, {"active": True})
