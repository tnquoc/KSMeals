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
- `.github/workflows/daily.yml` runs crawl + process + nutrition at 05:00 VN. `web.yml` publishes the Expo web build to https://tnquoc.github.io/KSMeals/ on changes under `app/` and after each daily run; it also writes one static page per school (`app/scripts/school-pages.mjs`, `/truong/<code>/`) + `sitemap.xml` for Google.
- Morning reminders: Web Push (`app/public/sw.js`, `app/src/lib/push.ts`, table `push_subscriptions` from migration 0010), sent by `pipeline/push.py` from `push.yml` at 06:30 VN on school days (`--dry-run` to preview).
- `supabase/functions/chat` (Edge Function, Gemini). Deploy: token `SUPABASE_ACCESS_TOKEN` in `.env` (scoped, expires ~2026-12-25), `npx supabase@2.118.0 functions deploy chat --project-ref <ref from SUPABASE_URL> --no-verify-jwt --use-api`. No logs command: debug by temporarily returning error details.
- `app/` Expo SDK 57 + Expo Router: tabs in `src/app/(tabs)` (index, week, ask, school), `/privacy` outside. Reads Supabase REST with the publishable key; anonymous events via RPC `track`.
- Local tools: `uv run python -m pipeline.devserver` (viewer + review at 127.0.0.1:8765), `pipeline.demand`, `pipeline.stats`, `pipeline.addresses`, `scripts/make_icons.py build shield_steam`.

## Gotchas
- Gemini free tier: `gemini-3.5-flash` = 20 req/day, so the default is `gemini-3.5-flash-lite`; chat and pipeline share the quota (chat limit `CHAT_DAILY_LIMIT`, default 20).
- Allergy answers must come from `meals.dish_allergens` + the allergen index built in code, never from the model's own reading. Allergies the parent types ("thịt vịt") are matched by `customMatcher`, kept identical in `app/src/lib/labels.ts` and `supabase/functions/chat/index.ts`.
- robots.txt disallows `/Timkiem`; crawl with `Fetcher` (low concurrency). School sites sometimes go down for ~15 min.
- Git Bash rewrites `/KSMeals` paths: use `MSYS_NO_PATHCONV=1` for local `EXPO_BASE_URL=/KSMeals npx expo export -p web`.
- A long-running `npx expo start` started before route changes regenerates bad typed routes (`/../lib/...`); restart it, or regenerate `.expo/types` before `npx tsc --noEmit`.
- Keys: `.env` (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ACCESS_TOKEN, VAPID_PRIVATE_KEY/VAPID_PUBLIC_KEY) never committed; `app/.env.local` holds the public values, the VAPID public key is in `app/src/lib/app-info.ts`. GitHub: secrets GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, VAPID_PRIVATE_KEY; variable CONTACT_EMAIL.

## Next up (see roadmap.md)
1. First YouTube Short is live (channel @KSMeals); read `pipeline.stats` weekly (key metric: devices active 3+ days/week; dev builds and automated browsers are no longer tracked, events before 2026-09-28 include Claude's test sessions).
2. Google Play: personal account created, waiting for identity verification; then choose the package name, Expo account, EAS build, closed testing (12 testers × 14 days, via a self-join Google Group). Apple later.
3. Google Search Console verified for https://tnquoc.github.io/KSMeals/; sitemap.xml to submit. A short domain (ksmeals.vn) would help: links in Shorts aren't clickable.
4. Allergy 2 levels (red "Có" from dish names vs orange "Thường có" from recipes, per-dish ingredients) — postponed by the owner.
5. Nhà trẻ/mẫu giáo variants; tray photos with children's faces are not blurred (owner's decision).
