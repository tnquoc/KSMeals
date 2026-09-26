"""Find the date range a menu post applies to, from its title or URL slug.

Posting date != menu week: a post on Fri 18/9 is usually next week's menu (21/9-25/9).
Titles/slugs often carry the range, which we use to cross-check the OCR output.
"""
import re
from datetime import date, timedelta

# 21/09/2026, 21/9, 21-9-2026, 21.09
DATE_RE = r"(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s*[/.\-]\s*(\d{4}))?"
RANGE_RE = re.compile(DATE_RE + r"\s*(?:-|–|đến(?:\s+ngày)?|den(?:\s+ngay)?)\s*(?:ngày\s*)?" + DATE_RE, re.I)

# Slugs drop separators: tu-ngay-2192026-den-ngay-2592026, 21092026-25092026
SLUG_RANGE_RE = re.compile(r"(\d{3,8})-(?:den-ngay-|den-|)(\d{3,8})")


def _near(candidates: list[date], anchor: date) -> date | None:
    return min(candidates, key=lambda d: abs((d - anchor).days)) if candidates else None


def _make(day: int, month: int, year: int | None, anchor: date) -> date | None:
    """Build a date; with no year, pick the year that lands closest to the anchor."""
    years = [year] if year else [anchor.year - 1, anchor.year, anchor.year + 1]
    options = []
    for y in years:
        try:
            options.append(date(y, month, day))
        except ValueError:
            pass
    return _near(options, anchor)


def _plausible(start: date | None, end: date | None, anchor: date) -> bool:
    return (
        start is not None and end is not None
        and 0 <= (end - start).days <= 31
        and abs((start - anchor).days) <= 60
    )


def parse_title_range(title: str, anchor: date) -> tuple[date, date] | None:
    for m in RANGE_RE.finditer(title or ""):
        d1, m1, y1, d2, m2, y2 = m.groups()
        y2 = int(y2) if y2 else None
        y1 = int(y1) if y1 else y2
        end = _make(int(d2), int(m2), y2, anchor)
        start = _make(int(d1), int(m1), y1, end or anchor)
        if _plausible(start, end, anchor):
            return start, end
    return None


def _split_digits(token: str, anchor: date) -> list[date]:
    """'2192026' -> 21/9/2026; '02102026' -> 02/10/2026; '219' -> 21/9 (year guessed)."""
    year = None
    if len(token) >= 7 and token[-4:].startswith("20"):
        year, token = int(token[-4:]), token[:-4]
    out = []
    for i in range(1, len(token)):
        d, mth = token[:i], token[i:]
        if len(d) > 2 or len(mth) > 2:
            continue
        got = _make(int(d), int(mth), year, anchor)
        if got:
            out.append(got)
    return out


def parse_slug_range(slug: str, anchor: date) -> tuple[date, date] | None:
    for m in SLUG_RANGE_RE.finditer(slug or ""):
        best = None
        for end in _split_digits(m.group(2), anchor):
            for start in _split_digits(m.group(1), end):
                if _plausible(start, end, anchor):
                    score = abs((start - anchor).days) + abs((end - start).days - 4)
                    if best is None or score < best[0]:
                        best = (score, start, end)
        if best:
            return best[1], best[2]
    # Dashed form: tu-ngay-21-9-den-ngay-25-9-2026
    return parse_title_range(re.sub(r"-den(?:-ngay)?-", " đến ", slug or ""), anchor)


WORDY_DATE_RE = r"(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?"


def dates_in_text(text: str, anchor: date) -> set[date]:
    """Every dd/mm(/yyyy) or 'dd tháng mm (năm yyyy)' in a title, e.g. {2026-09-22}."""
    out = set()
    matches = list(re.finditer(DATE_RE, text or "")) + list(re.finditer(WORDY_DATE_RE, text or "", re.I))
    for m in matches:
        d, mo, y = m.groups()
        got = _make(int(d), int(mo), int(y) if y else None, anchor)
        if got and abs((got - anchor).days) <= 60:
            out.add(got)
    return out


def week_of(d: date) -> tuple[date, date]:
    """Monday..Friday of the week containing d."""
    monday = d - timedelta(days=d.weekday())
    return monday, monday + timedelta(days=4)
