"""Offline tests for the parsers. Run: uv run python -m pipeline.test_parsers"""
import json
from datetime import date, timedelta
from pathlib import Path

from pipeline.allergens import detect
from pipeline.crawl import parse_post
from pipeline.dates import parse_slug_range, parse_title_range
from pipeline.discover import parse_schools, parse_ward_codes
from pipeline.split import build_meals
from pipeline.survey import classify, is_menu_post, parse_sitemap

FIXTURES = Path(__file__).parent / "fixtures"

WARD_HTML = """
<ul>
 <li class="nav-item"><a href="/dsdonvi.aspx?codekhoi=mn&amp;code=phuongx">Mầm non</a>
  <div class="dropdown_b"><fieldset>
   <label><a href="https://mn1tanbinh.hcm.edu.vn">Mầm non 1 </a></label>
  </fieldset></div></li>
 <li class="nav-item"><a href="/dsdonvi.aspx?codekhoi=th&amp;code=phuongx">Tiểu Học</a>
  <div class="dropdown_b"><fieldset>
   <label><a href="https://thlevansi.hcm.edu.vn">Tiểu Học  Lê Văn Sĩ</a></label>
  </fieldset></div></li>
 <li class="nav-item"><a href="/dsdonvi.aspx?codekhoi=pgddt">Phòng GD</a>
  <div><a href="https://adminpgd.hcm.edu.vn">admin</a></div></li>
</ul>
<a href="https://phuongbenthanh.hcm.edu.vn">Bến Thành</a>
<a href="https://xacangio.hcm.edu.vn">Cần Giờ</a>
<a href="https://dackhucondao.hcm.edu.vn">Côn Đảo</a>
<a href="https://csdl.hcm.edu.vn"></a>
"""

SITEMAP_XML = """<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 <url><loc>https://x.hcm.edu.vn/thuc-don-ban-tru/c/110439</loc></url>
 <url><loc>https://x.hcm.edu.vn/thuc-don-ban-tru/gui-cha-me-thuc-don/ct/110439/3</loc><lastmod>2026-09-18</lastmod></url>
 <url><loc>https://x.hcm.edu.vn/tin-tuc/thuc-don-tuan-1/ctfull/111297/2</loc><lastmod>2026-09-04</lastmod></url>
 <url><loc>https://x.hcm.edu.vn/ban-tru/dang-ky-ban-tru/ct/99354/1</loc><lastmod>2026-09-01</lastmod></url>
</urlset>"""


def test_ward_codes():
    assert parse_ward_codes(WARD_HTML) == {"phuongbenthanh", "xacangio", "dackhucondao"}


def test_schools_grouped_by_level():
    schools = parse_schools(WARD_HTML, "phuongx")
    assert [(s["code"], s["level"], s["name"]) for s in schools] == [
        ("mn1tanbinh", "mn", "Mầm non 1"),
        ("thlevansi", "th", "Tiểu Học Lê Văn Sĩ"),
    ]


def test_menu_post_detection():
    # Menu posts are found by post slug even outside a menu category.
    assert is_menu_post("https://x.hcm.edu.vn/tin-tuc/thuc-don-tuan-1/ctfull/111297/2")
    assert is_menu_post("https://x.hcm.edu.vn/thuc-don/tuan-3-21-9/ctmb/1/2")
    # Boarding registration notices are not menus.
    assert not is_menu_post("https://x.hcm.edu.vn/ban-tru/dang-ky-ban-tru/ct/99354/1")
    # Category pages are not posts.
    assert not is_menu_post("https://x.hcm.edu.vn/thuc-don-ban-tru/c/110439")


def test_sitemap_and_classify():
    entries, children = parse_sitemap(SITEMAP_XML)
    assert children == [] and len(entries) == 4
    menus = [(u, d) for u, d in entries if is_menu_post(u)]
    r = classify(menus, year_start=date(2026, 8, 24), today=date(2026, 9, 25))
    assert r["status"] == "regular" and r["weeks_with_posts"] == 2
    assert r["last_menu_date"] == "2026-09-18"

    # Same posts seen a month later: no longer regular.
    assert classify(menus, date(2026, 8, 24), date(2026, 10, 25))["status"] == "active"
    # Only last year's posts.
    assert classify(menus, date(2027, 8, 24), date(2027, 9, 25))["status"] == "stale"
    assert classify([], date(2026, 8, 24), date(2026, 9, 25))["status"] == "none"


def test_title_ranges():
    anchor = date(2026, 9, 18)
    assert parse_title_range("thực đơn Tuần 3 (21/09/2026 -25/09/2026)", anchor) == (date(2026, 9, 21), date(2026, 9, 25))
    assert parse_title_range("Thực đơn Tuần 3 - 21/9 đến 25/9", anchor) == (date(2026, 9, 21), date(2026, 9, 25))
    assert parse_title_range("từ ngày 10/8 đến ngày 14/8/2026", date(2026, 8, 7)) == (date(2026, 8, 10), date(2026, 8, 14))
    # School year, not a date range.
    assert parse_title_range("Thực đơn bán trú - Tuần 2 (2026-2027)", anchor) is None


def test_slug_ranges():
    anchor = date(2026, 9, 25)
    week4 = (date(2026, 9, 28), date(2026, 10, 2))
    assert parse_slug_range("thuc-don-cua-be-tu-ngay-2892026-den-ngay-02102026", anchor) == week4
    assert parse_slug_range("thuc-don-tuan-4-2892026-02102026", anchor) == week4
    week3 = (date(2026, 9, 21), date(2026, 9, 25))
    assert parse_slug_range("thuc-don-ban-tru-tu-ngay-219-2592026", anchor) == week3
    assert parse_slug_range("thuc-don-tuan-3-tu-21092026-den-25092026", anchor) == week3
    assert parse_slug_range("thuc-don-tuan-tu-ngay-21-9-den-ngay-25-9-2026", anchor) == week3
    assert parse_slug_range("thuc-don-tuan-2-nam-hoc-2025-2026", anchor) is None


def _levansi_ocr():
    return json.loads((FIXTURES / "ocr_levansi_w3.json").read_text(encoding="utf-8"))


def test_build_meals_real_menu():
    rows, issues = build_meals(_levansi_ocr(), "thực đơn Tuần 3 (21/09/2026 -25/09/2026)",
                               "bo-phan-ban-tru-thuc-don", date(2026, 9, 18))
    assert issues == []
    assert len(rows) == 10  # 5 days x (lunch + snack)
    friday = {r["meal_type"]: r["dishes"] for r in rows if r["date"] == date(2026, 9, 25)}
    assert friday["lunch"] == ["Bánh canh", "Chuối"]
    assert friday["snack"] == ["Bánh trung thu hình thỏ", "Sữa Vinamilk"]


def test_build_meals_flags_bad_dates():
    ocr = _levansi_ocr()
    ocr["days"][0]["date"] = "2026-09-12"  # misread: a Saturday, and outside the week
    _, issues = build_meals(ocr, "Tuần 3 (21/09/2026 -25/09/2026)", "", date(2026, 9, 18))
    assert any("not weekday" in i for i in issues)
    assert any("outside title/slug range" in i for i in issues)


def test_build_meals_fills_missing_dates_from_title():
    ocr = _levansi_ocr()
    for d in ocr["days"]:
        d["date"] = None
    ocr["week_start"] = None
    rows, issues = build_meals(ocr, "Tuần 3 (21/09/2026 -25/09/2026)", "", date(2026, 9, 18))
    assert issues == []
    assert sorted({r["date"] for r in rows}) == [date(2026, 9, 21) + timedelta(days=i) for i in range(5)]


def test_build_meals_trusts_date_confirmed_by_title():
    # Daily post; the model wrote weekday 5 for Friday 25/9 (Friday is 6), the date is right.
    ocr = {"kind": "weekly_menu", "days": [{"date": "2026-09-25", "weekday": 5, "meals": [
        {"meal_type": "lunch", "dishes": [{"name": "La gu + bánh mì", "course": "staple"}]}]}]}
    rows, issues = build_meals(ocr, "Hình ảnh bữa ăn bán trú ngày 25/09/2026", "", date(2026, 9, 25))
    assert issues == [] and rows[0]["date"] == date(2026, 9, 25)
    # Without the title confirming the date, the mismatch is still flagged.
    _, issues = build_meals(ocr, "Bữa ăn bán trú", "", date(2026, 9, 25))
    assert any("not weekday" in i for i in issues)


def test_build_meals_rejects_non_menu():
    rows, issues = build_meals({"kind": "tray_photo", "days": []}, "", "", date(2026, 9, 18))
    assert rows == [] and issues


def test_allergen_keywords():
    cases = {
        "Đậu đũa cà rốt xào tôm": ["crustacean"],
        "Cà rốt xào": [],                          # cà (carrot) is not cá (fish)
        "Cá diêu hồng sốt cà chua": ["fish"],
        "Sữa đậu nành Fami": ["soy"],              # soy milk is not dairy
        "Rau câu sữa tươi": ["milk"],
        "Yakult": ["milk"],                         # brand without the word "sữa"
        "Mì gạo xào": [],                           # rice noodles, no gluten
        "Miến gà": [],
        "Hủ tíu mì gà": ["gluten"],
        "Bánh flan": ["egg"],
        "Chả mực hấp mỡ hành": ["mollusc"],
        "Rau muống trộn mè rang": ["sesame"],
        "Tương ớt": [],
    }
    for dish, expected in cases.items():
        assert detect([dish]) == expected, (dish, detect([dish]))
    # Ingredients suggested by the LLM count too (hidden egg and milk in a sponge cake).
    assert detect(["Bánh bông lan chà bông", "bột mì", "trứng", "sữa"]) == ["egg", "milk", "gluten"]


# post id -> (n images, doc extensions): one of each layout seen in the pilot.
POST_CASES = {
    "1410805": (1, []),         # <img class="anhnoidung"> under /uploadimages/news/
    "888995": (1, []),          # <img class="img-responsive"> in the article
    "759529": (1, []),          # body image stored under /data/doc/
    "760791": (1, []),          # body image from the shared library (haydung)
    "760311": (0, [".pdf"]),    # PDF attachment; generic featured image ignored
    "1410758": (0, [".docx"]),  # Word file in an Office viewer iframe; school logo ignored
    "760970": (0, [".doc"]),    # legacy Word file
    "1411103": (0, []),         # only a traceability QR code: nothing to read
}


def test_post_layouts():
    for pid, (n_images, doc_exts) in POST_CASES.items():
        html = (FIXTURES / "posts" / f"{pid}.html").read_text(encoding="utf-8")
        post = parse_post(html, f"https://x.hcm.edu.vn/thuc-don/thuc-don-tuan/ct/1/{pid}")
        assert len(post["image_urls"]) == n_images, (pid, post["image_urls"])
        assert [Path(u).suffix for u in post["doc_urls"]] == doc_exts, (pid, post["doc_urls"])
        assert post["title"], pid
        assert not any("?w=" in u for u in post["image_urls"]), pid  # full-size originals


def test_post_metadata():
    html = (FIXTURES / "posts" / "1410805.html").read_text(encoding="utf-8")
    post = parse_post(html, "https://x.hcm.edu.vn/thuc-don-ban-tru/bo-phan-ban-tru/ct/110439/1410805")
    assert post["title"].endswith("thực đơn Tuần 3 (21/09/2026 -25/09/2026)")
    assert post["published_at"] == "2026-09-18T20:22:00"
    assert post["kind"] == "menu"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"ok  {name}")
