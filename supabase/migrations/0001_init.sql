-- KSMeals initial schema.
-- Writes happen only from the pipeline with the service_role key (bypasses RLS).
-- The app uses the anon key and can only read published data.

create table schools (
  id              bigint generated always as identity primary key,
  code            text not null unique,            -- subdomain, e.g. thlevansi
  name            text not null,
  level           text not null check (level in ('mn', 'th', 'thcs')),
  ward            text not null,                   -- ward portal code, e.g. phuongtansonhoa
  coverage_status text,                            -- regular | active | stale | none (from survey)
  last_menu_date  date,
  active          boolean not null default false,  -- shown in the app
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table raw_posts (
  id           bigint generated always as identity primary key,
  school_id    bigint not null references schools (id) on delete cascade,
  post_id      text not null,                      -- CMS post id from the URL
  kind         text not null default 'menu' check (kind in ('menu', 'tray')),
  url          text not null,
  title        text,
  published_at date,
  image_urls   text[] not null default '{}',
  status       text not null default 'pending'
               check (status in ('pending', 'ocr_done', 'published', 'needs_review', 'not_menu', 'failed')),
  error        text,
  crawled_at   timestamptz not null default now(),
  unique (school_id, post_id)
);
create index raw_posts_status_idx on raw_posts (status);

create table menu_weeks (
  id          bigint generated always as identity primary key,
  raw_post_id bigint not null unique references raw_posts (id) on delete cascade,
  week_start  date,
  week_end    date,
  json_raw    jsonb not null,                      -- untouched OCR output, re-parse without re-OCR
  model       text not null,
  created_at  timestamptz not null default now()
);

create table meals (
  id             bigint generated always as identity primary key,
  school_id      bigint not null references schools (id) on delete cascade,
  date           date not null,
  meal_type      text not null default 'lunch',    -- breakfast | lunch | snack
  dishes         text[] not null default '{}',
  ingredients    text[] not null default '{}',
  allergens      text[] not null default '{}',
  nutrition      jsonb,                            -- estimated: kcal, protein_g, fat_g, carbs_g
  ai_note        text,
  tray_image_url text,
  source_post_id bigint references raw_posts (id) on delete set null,
  status         text not null default 'published' check (status in ('published', 'needs_review')),
  updated_at     timestamptz not null default now(),
  unique (school_id, date, meal_type)
);
create index meals_school_date_idx on meals (school_id, date);

create table devices (
  id         uuid primary key default gen_random_uuid(),
  push_token text unique,
  school_id  bigint references schools (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

create table chat_usage (
  device_id uuid not null references devices (id) on delete cascade,
  date      date not null,
  count     int not null default 0,
  primary key (device_id, date)
);

-- "Notify me when my school is supported"
create table school_requests (
  id          bigint generated always as identity primary key,
  device_id   uuid references devices (id) on delete cascade,
  school_code text not null,
  created_at  timestamptz not null default now()
);

-- Row level security: everything locked by default, then open read-only views for the app.
alter table schools         enable row level security;
alter table raw_posts       enable row level security;
alter table menu_weeks      enable row level security;
alter table meals           enable row level security;
alter table devices         enable row level security;
alter table chat_usage      enable row level security;
alter table school_requests enable row level security;

create policy "public read active schools" on schools
  for select to anon, authenticated using (active);

-- The project does not auto-expose new tables to the Data API, so grant explicitly:
-- the pipeline (service_role) writes everything; the app (anon) can only read these two tables,
-- further filtered by the RLS policies below.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select on schools, meals to anon, authenticated;

create policy "public read published meals" on meals
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from schools s where s.id = meals.school_id and s.active)
  );
