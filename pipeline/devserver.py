"""Local web server for looking at the data.

  /         viewer: what the app will show (publishable key, in the browser)
  /review   review tool for posts that need a human (secret key, server side only)

Binds to 127.0.0.1 only; the secret key never leaves this process.

Usage: uv run python -m pipeline.devserver [--port 8765]
"""
import argparse
import json
import mimetypes
import os
import re
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from pipeline import config
from pipeline.process import interpret
from pipeline.store import Store

WEB_DIR = config.ROOT / "web"
REVIEW_STATUSES = "needs_review,failed"


def review_items(store: Store) -> list[dict]:
    posts = store.select("raw_posts", select="*,schools(code,name)", order="published_at.desc",
                         status=f"in.({REVIEW_STATUSES})")
    if not posts:
        return []
    ids = ",".join(str(p["id"]) for p in posts)
    weeks = {w["raw_post_id"]: w["json_raw"] for w in
             store.select("menu_weeks", select="raw_post_id,json_raw", raw_post_id=f"in.({ids})")}
    meals: dict[int, list] = {}
    for m in store.select("meals", select="source_post_id,date,meal_type,dishes,courses,status",
                          source_post_id=f"in.({ids})", order="date,meal_type"):
        meals.setdefault(m["source_post_id"], []).append(m)
    for p in posts:
        p["school"] = p.pop("schools")
        p["ocr"] = weeks.get(p["id"])
        p["meals"] = meals.get(p["id"], [])
    return posts


def get_post(store: Store, post_id: int) -> dict:
    rows = store.select("raw_posts", select="*,schools(code)", id=f"eq.{post_id}")
    if not rows:
        raise KeyError(post_id)
    post = rows[0]
    post["school_code"] = post.pop("schools")["code"]
    return post


def action(store: Store, post_id: int, name: str, body: dict) -> dict:
    post = get_post(store, post_id)
    if name == "approve":
        # Publish as-is: the reviewer checked the meals against the image.
        store.update("meals", {"source_post_id": post_id}, {"status": "published"})
        store.update("raw_posts", {"id": post_id}, {"status": "published", "error": None})
        store.update("schools", {"id": post["school_id"]}, {"active": True})
        return {"ok": True}
    if name == "reject":
        store.delete("meals", {"source_post_id": post_id})
        store.update("raw_posts", {"id": post_id}, {"status": "not_menu", "error": "rejected in review"})
        return {"ok": True}
    if name == "retry":
        # Back to the queue: the next pipeline run downloads and OCRs it again.
        store.update("raw_posts", {"id": post_id}, {"status": "pending", "error": None})
        return {"ok": True}
    if name == "resplit":
        # Re-split edited OCR JSON; preview only unless save=true.
        ocr = body["ocr"]
        post["published_at"] = post["published_at"] or date.today().isoformat()
        meals, trays = interpret(post, ocr)
        result = {"status": post["status"], "issues": post["error"], "meals": meals, "trays": trays}
        if body.get("save"):
            if body.get("force") and post["status"] == "needs_review":
                post["status"], post["error"] = "published", None
                for m in meals:
                    m["status"] = "published"
            store.delete("meals", {"source_post_id": post_id})
            store.finish_post(post, ocr, meals, trays)
            result["saved"] = True
        return result
    raise KeyError(name)


class Handler(BaseHTTPRequestHandler):
    store: Store

    def _send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, data):
        self._send(code, json.dumps(data, ensure_ascii=False, default=str).encode(), "application/json; charset=utf-8")

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/config.js":
            cfg = {"supabaseUrl": config.SUPABASE_URL, "publishableKey": os.getenv("SUPABASE_PUBLISHABLE_KEY", "")}
            return self._send(200, f"window.KSMEALS = {json.dumps(cfg)};".encode(), "text/javascript")
        if path == "/api/review":
            return self._json(200, review_items(self.store))
        name = {"/": "index.html", "/review": "review.html"}.get(path, path.lstrip("/"))
        file = (WEB_DIR / name).resolve()
        if WEB_DIR.resolve() not in file.parents or not file.is_file():
            return self._send(404, b"not found", "text/plain")
        ctype = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
        self._send(200, file.read_bytes(), ctype + ("; charset=utf-8" if ctype.startswith("text") else ""))

    def do_POST(self):
        m = re.fullmatch(r"/api/review/(\d+)/(approve|reject|retry|resplit)", self.path)
        if not m:
            return self._json(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        try:
            self._json(200, action(self.store, int(m.group(1)), m.group(2), body))
        except Exception as e:
            self._json(400, {"error": f"{type(e).__name__}: {e}"})

    def log_message(self, fmt, *args):
        if not self.path.startswith(("/config.js", "/style")):
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()
    Handler.store = Store()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"viewer: http://127.0.0.1:{args.port}/   review: http://127.0.0.1:{args.port}/review")
    server.serve_forever()


if __name__ == "__main__":
    main()
