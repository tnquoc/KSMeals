-- Anonymous usage events, to learn whether parents come back and which features they use.
-- No names, no message contents: an anonymous device id, an event name, a school code and a few flags.

create table if not exists events (
  id          bigint generated always as identity primary key,
  device_id   uuid not null,
  name        text not null,
  school_code text,
  platform    text,
  props       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists events_created_idx on events (created_at);
create index if not exists events_device_idx on events (device_id, created_at);

alter table events enable row level security;  -- no policies: only the pipeline (secret key) reads it
grant all on events to service_role;
grant usage, select on sequence events_id_seq to service_role;

-- The app records events through this function only; it checks names and sizes.
create or replace function track(p_device uuid, p_name text, p_school text default null,
                                 p_platform text default null, p_props jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_device is null or p_name not in (
    'app_open', 'view_day', 'view_week', 'chat_sent', 'allergies_set',
    'school_selected', 'school_requested', 'share'
  ) then
    raise exception 'invalid event';
  end if;
  if length(coalesce(p_props::text, '')) > 500 or length(coalesce(p_school, '')) > 64 then
    raise exception 'event too large';
  end if;
  insert into events (device_id, name, school_code, platform, props)
  values (p_device, p_name, p_school, left(p_platform, 16), coalesce(p_props, '{}'));
end;
$$;

revoke all on function track(uuid, text, text, text, jsonb) from public;
grant execute on function track(uuid, text, text, text, jsonb) to anon, authenticated;
