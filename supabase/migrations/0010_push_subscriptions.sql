-- Morning menu reminders through Web Push (browser notifications on the web app).
-- One row per browser subscription: where to send, which school, which allergy groups to warn about.
-- The endpoint is an opaque URL from the browser's push service; no personal data.

create table if not exists push_subscriptions (
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  device_id   uuid not null,
  school_id   bigint not null references schools (id) on delete cascade,
  allergies   text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_school_idx on push_subscriptions (school_id);

alter table push_subscriptions enable row level security;  -- no policies: only the sender (secret key) reads it
grant all on push_subscriptions to service_role;

-- The app subscribes, changes school/allergies and unsubscribes only through these functions.
create or replace function subscribe_push(p_device uuid, p_school bigint, p_endpoint text,
                                          p_p256dh text, p_auth text, p_allergies text[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_device is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or length(coalesce(p_p256dh, '')) not between 20 and 200 or length(coalesce(p_auth, '')) not between 8 and 100
     or coalesce(array_length(p_allergies, 1), 0) > 20
     or not exists (select 1 from schools where id = p_school and active) then
    raise exception 'invalid subscription';
  end if;
  insert into push_subscriptions (endpoint, p256dh, auth, device_id, school_id, allergies)
  values (p_endpoint, p_p256dh, p_auth, p_device, p_school, coalesce(p_allergies, '{}'))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, device_id = excluded.device_id,
        school_id = excluded.school_id, allergies = excluded.allergies, updated_at = now();
end;
$$;

-- Knowing the endpoint (a long random URL held only by that browser) is what allows removing it.
create or replace function unsubscribe_push(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function subscribe_push(uuid, bigint, text, text, text, text[]) from public;
revoke all on function unsubscribe_push(text) from public;
grant execute on function subscribe_push(uuid, bigint, text, text, text, text[]) to anon, authenticated;
grant execute on function unsubscribe_push(text) to anon, authenticated;

-- Usage events: also count reminders switched on/off (same function as 0008, two more names).
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
    'school_selected', 'school_requested', 'share', 'push_on', 'push_off'
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
