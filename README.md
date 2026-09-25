# KSMeals (KidSafeMeals)

App giúp phụ huynh TP.HCM theo dõi thực đơn bán trú của con, dữ liệu lấy từ website công khai của trường.

## Structure

```
pipeline/             Python data pipeline (see below)
data/                 schools.csv, coverage.csv (from discover/survey)
supabase/migrations/  database schema, run in order in the Supabase SQL Editor
.github/workflows/    daily.yml (05:00 VN), connectivity.yml (manual check)
roadmap.md            plan and progress
```

## Setup

Uses [uv](https://docs.astral.sh/uv/): Python version from `.python-version`, exact
dependency versions in `pyproject.toml` (`==`) and `uv.lock`.

```bash
uv sync
uv run python -m pipeline.test_parsers
```

`.env` (never committed):

```
GEMINI_API_KEY=...
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Optional: `LLM_MODEL` (default `gemini-3.5-flash-lite`), `LLM_BASE_URL` (any OpenAI-compatible
endpoint), `LLM_MIN_INTERVAL` (seconds between LLM calls, default 12).

Add a dependency: `uv add <package>==<version>` (keep exact pins).

## Pipeline

Most public schools in HCMC run on the shared Quang Ich CMS at `<code>.hcm.edu.vn`.

| Step | Command | What it does |
|---|---|---|
| discover | `uv run python -m pipeline.discover` | Walk the 168 ward portals → `data/schools.csv` (1,293 schools) |
| survey | `uv run python -m pipeline.survey` | One `sitemap.xml` per school → `data/coverage.csv` (who posts menus, how often) |
| sync | `uv run python -m pipeline.sync` | School list → Supabase `schools` |
| crawl | `uv run python -m pipeline.crawl --active-only` | New menu posts → Supabase `raw_posts` (pending) |
| process | `uv run python -m pipeline.process` | Download images/PDF/Word/Excel, Gemini OCR, split into days → `menu_weeks`, `meals` |

All pipeline state lives in Supabase, so any run (local or GitHub Actions) resumes where the last
one stopped, e.g. after the free Gemini quota runs out.

Crawling rules: respect robots.txt (`/Timkiem` is disallowed, so no site search), max 2–4
concurrent requests, retries with backoff.
