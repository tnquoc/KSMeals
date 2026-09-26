"""Estimate nutrition and write a short note for each meal; detect allergens by keyword.

One text-only LLM call per school-week (cheap), for published meals that have no
nutrition yet, so it resumes after a quota stop like process.py.

Usage: uv run python -m pipeline.nutrition [--limit N]
"""
import argparse
import json
import time
from collections import defaultdict
from datetime import date

from pipeline import config
from pipeline.allergens import detect
from pipeline.ocr import make_client
from pipeline.process import DailyQuotaExhausted, call_with_backoff
from pipeline.store import Store

AGE = {"mn": "3-5 tuổi (mầm non)", "th": "6-10 tuổi (tiểu học)", "thcs": "11-14 tuổi (THCS)"}
MEAL = {"breakfast": "bữa sáng", "morning_snack": "bữa phụ sáng", "lunch": "bữa trưa", "snack": "bữa xế"}
KCAL_RANGE = (40, 1200)  # per meal; outside this the estimate is dropped as nonsense

SCHEMA = {
    "type": "object",
    "properties": {
        "meals": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    "meal_type": {"type": "string", "enum": list(MEAL)},
                    "ingredients": {"type": "array", "items": {"type": "string"}},
                    "kcal": {"type": "number"},
                    "protein_g": {"type": "number"},
                    "fat_g": {"type": "number"},
                    "carbs_g": {"type": "number"},
                    "note": {"type": "string"},
                },
                "required": ["date", "meal_type", "ingredients", "kcal", "protein_g", "fat_g", "carbs_g", "note"],
            },
        },
    },
    "required": ["meals"],
}

SYSTEM_PROMPT = """You are a pediatric nutrition assistant for Vietnamese school meals (bữa ăn bán trú).
For each meal you get the dish names. Return, per meal:
- ingredients: the main ingredients a Vietnamese school kitchen would use for these dishes
  (Vietnamese, lowercase, e.g. "cá diêu hồng", "cà chua", "thịt heo", "tôm", "bột mì", "trứng", "sữa").
  Include hidden ones that are standard for the dish (bánh flan -> trứng, sữa; chả giò -> tôm/thịt, bánh tráng).
- kcal, protein_g, fat_g, carbs_g: estimate for ONE typical school portion for the given age group.
- note: one short, neutral sentence in Vietnamese (max 20 words) about which food groups the meal
  covers (tinh bột, đạm, rau củ, trái cây, sữa) and, if relevant, which one is light or missing.
  Good: "Bữa trưa đủ tinh bột, đạm từ cá và thịt, có rau và trái cây."
  Good: "Bữa xế chủ yếu tinh bột và sữa, ít rau."
  Bad (never do this): praising taste or freshness ("thơm ngon", "tươi ngon"), health claims
  ("tốt cho tiêu hóa", "giàu sắt", "tăng đề kháng"), criticising the school, medical advice,
  or saying a dish is safe for allergies.
Return every meal you were given, with the same date and meal_type."""


def estimate(client, level: str, meals: list[dict]) -> list[dict]:
    lines = [f"Age group: {AGE.get(level, level)}", ""]
    for m in meals:
        lines.append(f"{m['date']} {m['meal_type']}: " + "; ".join(m["dishes"]))
    resp = client.chat.completions.create(
        model=config.LLM_MODEL,
        temperature=0,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": "\n".join(lines)}],
        response_format={"type": "json_schema", "json_schema": {"name": "nutrition", "schema": SCHEMA}},
    )
    return json.loads(resp.choices[0].message.content)["meals"]


def to_row(meal: dict, est: dict | None) -> dict:
    """Values to store. Allergens come from keywords on dish names + suggested ingredients."""
    ingredients = [i.strip().lower() for i in (est or {}).get("ingredients", []) if i.strip()]
    row = {"ingredients": ingredients, "allergens": detect(meal["dishes"] + ingredients)}
    kcal = (est or {}).get("kcal")
    if est and kcal and KCAL_RANGE[0] <= kcal <= KCAL_RANGE[1]:
        row["nutrition"] = {k: round(float(est[k]), 1) for k in ("kcal", "protein_g", "fat_g", "carbs_g")}
        row["nutrition"]["estimated"] = True
        row["ai_note"] = est.get("note", "").strip() or None
    else:
        # Keep the row out of the queue even if the estimate was unusable.
        row["nutrition"] = {"estimated": True, "unavailable": True}
        row["ai_note"] = None
    return row


def todo_groups(store: Store) -> list[tuple[int, str, list[dict]]]:
    """(school_id, level, meals) per school and ISO week, for published meals without nutrition."""
    rows = store.select("meals", select="id,school_id,date,meal_type,dishes,schools(level)",
                        status="eq.published", nutrition="is.null", order="school_id,date")
    groups = defaultdict(list)
    for r in rows:
        if not r["dishes"]:  # tray-photo-only rows have nothing to estimate
            continue
        week = date.fromisoformat(r["date"]).isocalendar()[:2]
        groups[(r["school_id"], r["schools"]["level"], week)].append(r)
    return [(sid, level, meals) for (sid, level, _), meals in groups.items()]


def run(limit: int | None):
    store = Store()
    groups = todo_groups(store)[:limit] if limit else todo_groups(store)
    print(f"nutrition for {len(groups)} school-weeks ({sum(len(g[2]) for g in groups)} meals), {config.LLM_MODEL}")
    client = make_client()
    t = time.time()
    for i, (school_id, level, meals) in enumerate(groups, 1):
        try:
            estimates = call_with_backoff(lambda: estimate(client, level, meals))
        except DailyQuotaExhausted as e:
            print(f"daily LLM quota exhausted after {i - 1} groups; the rest wait for the next run.\n  {e}")
            break
        except Exception as e:
            print(f"  {i}/{len(groups)} school {school_id}: failed {type(e).__name__}: {str(e)[:150]}")
            continue
        by_key = {(e["date"], e["meal_type"]): e for e in estimates}
        for m in meals:
            store.update("meals", {"id": m["id"]}, to_row(m, by_key.get((m["date"], m["meal_type"]))))
        missing = sum((m["date"], m["meal_type"]) not in by_key for m in meals)
        print(f"  {i}/{len(groups)} school {school_id} week of {meals[0]['date']}: {len(meals)} meals" + (f", {missing} without estimate" if missing else ""), flush=True)
    print(f"done in {time.time() - t:.0f}s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="only the first N school-weeks")
    run(ap.parse_args().limit)


if __name__ == "__main__":
    main()
