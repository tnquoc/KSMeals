-- Usage events: also count a parent starting to type in the school search (no text is sent),
-- to tell real visitors from crawlers that only open the page. Same function as 0010, one more name.
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
    'school_selected', 'school_requested', 'share', 'push_on', 'push_off', 'school_search'
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
