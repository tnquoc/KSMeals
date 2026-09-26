# KSMeals — notes for Claude

Parents' app for Ho Chi Minh City school lunch menus (thực đơn bán trú). Solo indie project.
Plan and progress: `roadmap.md`. Setup and commands: `README.md`. App-specific rules: `app/AGENTS.md`.

## Working with the owner
- Reply in Vietnamese; code, file names, identifiers and commit messages in English.
- Python: uv only (`pyproject.toml` + `uv.lock`), exact `==` pins, no requirements.txt. npm: exact pins (`app/.npmrc` save-exact).
- Work on `main`. Commit and push after each finished feature; scan staged files for keys before committing.
- The owner runs Supabase migrations by hand in the SQL Editor: write `supabase/migrations/00NN_*.sql`, ask them to run it, then verify with the publishable key.
- Money is tight: prefer free tiers (Gemini free, Supabase free, GitHub Actions/Pages). No Apple Developer account yet.

## Architecture
- `pipeline/` (Python): discover → survey → crawl (`--tracked`, list in `data/tracked_schools.txt`) → process (Gemini OCR) → nutrition (+ keyword allergens in `pipeline/allergens.py`). State lives in Supabase (`pipeline/store.py`). Tests: `uv run python -m pipeline.test_parsers`.
- `.github/workflows/daily.yml` runs crawl + process + nutrition at 05:00 VN. `web.yml` publishes the Expo web build to https://tnquoc.github.io/KSMeals/ on changes under `app/`.
- `supabase/functions/chat` (Edge Function, Gemini). Deploy: token `SUPABASE_ACCESS_TOKEN` in `.env` (scoped, expires ~2026-12-25), `npx supabase@2.118.0 functions deploy chat --project-ref <ref from SUPABASE_URL> --no-verify-jwt --use-api`. No logs command: debug by temporarily returning error details.
- `app/` Expo SDK 57 + Expo Router: tabs in `src/app/(tabs)` (index, week, ask, school), `/privacy` outside. Reads Supabase REST with the publishable key; anonymous events via RPC `track`.
- Local tools: `uv run python -m pipeline.devserver` (viewer + review at 127.0.0.1:8765), `pipeline.demand`, `pipeline.stats`, `pipeline.addresses`, `scripts/make_icons.py build shield_steam`.

## Gotchas
- Gemini free tier: `gemini-3.5-flash` = 20 req/day, so the default is `gemini-3.5-flash-lite`; chat and pipeline share the quota (chat limit `CHAT_DAILY_LIMIT`, default 20).
- Allergy answers must come from `meals.dish_allergens` + the allergen index built in code, never from the model's own reading.
- robots.txt disallows `/Timkiem`; crawl with `Fetcher` (low concurrency). School sites sometimes go down for ~15 min.
- Git Bash rewrites `/KSMeals` paths: use `MSYS_NO_PATHCONV=1` for local `EXPO_BASE_URL=/KSMeals npx expo export -p web`.
- A long-running `npx expo start` started before route changes regenerates bad typed routes (`/../lib/...`); restart it, or regenerate `.expo/types` before `npx tsc --noEmit`.
- Keys: `.env` (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ACCESS_TOKEN) never committed; `app/.env.local` holds the public values. GitHub: secrets GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY; variable CONTACT_EMAIL.

## Next up (see roadmap.md)
1. Owner shares the web link with parents in the 7 tracked wards; after 1–2 weeks read `pipeline.stats` (key metric: devices active 3+ days/week).
2. Google Play first (USD 25): EAS build + morning push notifications. Apple later.
3. Allergy 2 levels (red "Có" from dish names vs orange "Thường có" from recipes, per-dish ingredients) — postponed by the owner.
4. Legacy .doc/.xls menus (LibreOffice on Actions); nhà trẻ/mẫu giáo variants; tray photos with children's faces are not blurred (owner's decision).
