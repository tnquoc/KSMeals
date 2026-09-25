"""Read a school menu image into structured JSON with a vision LLM.

Usage (single image, for testing): uv run python -m pipeline.ocr path/to/menu.png [--title "..."]
"""
import argparse
import base64
import io
import json
from datetime import date

from openai import OpenAI
from PIL import Image

from pipeline import config

MAX_IMAGE_SIDE = 2400

COURSES = ["staple", "main", "soup", "stir_fry", "side", "dessert", "drink", "other"]

MENU_SCHEMA = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": ["weekly_menu", "tray_photo", "other"]},
        "week_start": {"type": "string", "nullable": True, "description": "YYYY-MM-DD"},
        "week_end": {"type": "string", "nullable": True, "description": "YYYY-MM-DD"},
        "days": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "nullable": True, "description": "YYYY-MM-DD"},
                    "weekday": {"type": "integer", "description": "Vietnamese weekday: Thứ Hai=2 ... Thứ Bảy=7"},
                    "meals": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "meal_type": {"type": "string", "enum": ["breakfast", "lunch", "snack"]},
                                "dishes": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "name": {"type": "string"},
                                            "course": {"type": "string", "enum": COURSES},
                                        },
                                        "required": ["name", "course"],
                                    },
                                },
                            },
                            "required": ["meal_type", "dishes"],
                        },
                    },
                },
                "required": ["weekday", "meals"],
            },
        },
        "notes": {"type": "string", "nullable": True},
    },
    "required": ["kind", "days"],
}

SYSTEM_PROMPT = """You read Vietnamese school meal menus (thực đơn bán trú) from images or document text and return JSON.

Rules:
- kind: "weekly_menu" if the image is a menu table; "tray_photo" if it is a photo of served food; otherwise "other" (and return no days).
- Copy dish names exactly as written in Vietnamese, with diacritics. Never translate, never invent dishes.
- One entry in `days` per school day in the table. weekday: Thứ Hai=2, Ba=3, Tư=4, Năm=5, Sáu=6, Bảy=7.
- date: read it from the table if shown; otherwise derive from the "áp dụng" date range; otherwise null.
- meal_type: "Bữa sáng" -> breakfast; main meal (cơm, món mặn, canh, xào, tráng miệng) -> lunch; "Bữa xế"/"Bữa phụ"/afternoon -> snack.
- course: Cơm/bún/phở/mì as the base -> staple; món mặn -> main; canh -> soup; món xào -> stir_fry; tráng miệng/trái cây -> dessert; sữa/nước -> drink.
- A cell merged across several columns is ONE dish (e.g. "Bánh canh" spanning main+soup is a single staple dish).
- A cell listing several items ("Bánh trung thu, Sữa Vinamilk") is several dishes.
- Leave out decorative slogans. Put anything unusual (holidays, "nghỉ", vegetarian days) in notes."""


def image_to_data_url(data: bytes) -> str:
    """Downscale very large images and re-encode as JPEG to keep requests small."""
    im = Image.open(io.BytesIO(data))
    im = im.convert("RGB")
    if max(im.size) > MAX_IMAGE_SIDE:
        im.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def make_client() -> OpenAI:
    return OpenAI(api_key=config.LLM_API_KEY, base_url=config.LLM_BASE_URL, max_retries=5)


def extract_menu(images: list[bytes], title: str = "", published_at: date | None = None,
                 text: str = "", client: OpenAI | None = None, model: str = config.LLM_MODEL) -> dict:
    """Images and/or text (from Word/Excel attachments) -> menu JSON."""
    client = client or make_client()
    context = f"Post title: {title or '-'}\nPublished: {published_at or '-'}"
    if text:
        context += f"\n\nAttached document text (table cells separated by |):\n{text[:20000]}"
    content = [{"type": "text", "text": context}]
    content += [{"type": "image_url", "image_url": {"url": image_to_data_url(b)}} for b in images]

    resp = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "school_menu", "schema": MENU_SCHEMA},
        },
    )
    return json.loads(resp.choices[0].message.content)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--title", default="")
    args = ap.parse_args()
    images = [open(p, "rb").read() for p in args.images]
    print(json.dumps(extract_menu(images, args.title), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
