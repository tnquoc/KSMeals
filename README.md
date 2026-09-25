# KSMeals (KidSafeMeals)

App giúp phụ huynh TP.HCM theo dõi thực đơn bán trú của con, dữ liệu lấy từ website công khai của trường.

## Structure

```
pipeline/   Python: school discovery, coverage survey, (later) menu crawl + OCR
data/      Generated CSVs (schools.csv, coverage.csv)
```

## Crawler

Most public schools in HCMC run on the shared Quang Ich CMS at `<code>.hcm.edu.vn`.

- `pipeline/discover.py`: walks the 168 ward/commune portals (`phuong*`, `xa*`, `dackhu*`); each portal's nav lists its schools by level (`mn`, `th`, `thcs`). Output: `data/schools.csv`.
- `pipeline/survey.py`: one `sitemap.xml` request per school. Menu posts are detected by URL slug (`thuc-don`, `suat-an`, ...). Output: `data/coverage.csv` plus a summary by level.

```bash
pip install -r pipeline/requirements.txt
python -m pipeline.test_parsers
python -m pipeline.discover
python -m pipeline.survey
```

Crawling rules: respect robots.txt (`/Timkiem` is disallowed, so no site search), max 4 concurrent requests, retries with backoff.
