"""Turn one OCR'd weekly menu into per-day meal rows, with quality checks.

Every problem found is reported as an issue; any issue sends the post to
needs_review instead of the app. Showing nothing beats showing the wrong food.
"""
from datetime import date, timedelta

from pipeline.dates import parse_slug_range, parse_title_range, week_of

MAX_DAYS_BEFORE_POST = 21   # menus are posted ahead of time, rarely long after
MAX_DAYS_AFTER_POST = 45    # some schools post a whole month at once


def _iso(s: str | None) -> date | None:
    try:
        return date.fromisoformat(s) if s else None
    except ValueError:
        return None


def hint_range(title: str, slug: str, published_at: date) -> tuple[date, date] | None:
    return parse_title_range(title, published_at) or parse_slug_range(slug, published_at)


def build_meals(ocr: dict, title: str, slug: str, published_at: date) -> tuple[list[dict], list[str]]:
    """Return (meal rows, issues). Rows have date, meal_type, dishes (names), courses."""
    issues = []
    if ocr.get("kind") != "weekly_menu":
        return [], [f"not a menu: kind={ocr.get('kind')}"]
    days = ocr.get("days") or []
    if not days:
        return [], ["no days read"]

    hint = hint_range(title, slug, published_at)
    ocr_start = _iso(ocr.get("week_start"))
    if hint and ocr_start and ocr_start != hint[0]:
        issues.append(f"week start mismatch: image {ocr_start}, title/slug {hint[0]}")

    # Monday used when a day has no readable date.
    fallback_monday = ocr_start or (hint[0] if hint else None)
    if fallback_monday:
        fallback_monday = week_of(fallback_monday)[0]

    rows, seen = [], set()
    for day in days:
        weekday = day.get("weekday")
        d = _iso(day.get("date"))
        if d is None and fallback_monday and isinstance(weekday, int) and 2 <= weekday <= 7:
            d = fallback_monday + timedelta(days=weekday - 2)
        if d is None:
            issues.append(f"no date for weekday {weekday}")
            continue
        if isinstance(weekday, int) and d.isoweekday() + 1 != weekday:
            issues.append(f"{d} is not weekday {weekday} (misread date?)")
        if not (-MAX_DAYS_BEFORE_POST <= (d - published_at).days <= MAX_DAYS_AFTER_POST):
            issues.append(f"{d} too far from post date {published_at}")
        if hint and not (hint[0] <= d <= hint[1] + timedelta(days=1)):
            issues.append(f"{d} outside title/slug range {hint[0]}..{hint[1]}")

        for meal in day.get("meals") or []:
            key = (d, meal.get("meal_type"))
            if key in seen:
                issues.append(f"duplicate {key[1]} on {d}")
                continue
            seen.add(key)
            dishes = [x for x in meal.get("dishes") or [] if x.get("name", "").strip()]
            if not dishes:
                continue
            rows.append({
                "date": d,
                "meal_type": meal["meal_type"],
                "dishes": [x["name"].strip() for x in dishes],
                "courses": [x.get("course", "other") for x in dishes],
            })

    if not any(r["meal_type"] == "lunch" for r in rows):
        issues.append("no lunch found")
    return rows, issues
