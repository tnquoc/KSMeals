-- "Báo tôi khi có": parents can find any of the public schools and ask for one we don't cover yet.

-- 1. The school directory is public information: let the app list every school,
--    not only the active ones (the app filters with active=eq.true where it needs to).
drop policy if exists "public read active schools" on schools;
create policy "public read schools" on schools
  for select to anon, authenticated using (true);

-- 2. One request per device per school.
create unique index if not exists school_requests_device_school_idx on school_requests (device_id, school_code);

-- 3. The app never writes tables directly; it calls this function, which validates input.
--    Returns how many devices have asked for this school so far.
create or replace function request_school(p_device uuid, p_code text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
begin
  if p_device is null or not exists (select 1 from schools where code = p_code) then
    raise exception 'unknown school';
  end if;
  insert into devices (id) values (p_device) on conflict (id) do update set last_seen = now();
  insert into school_requests (device_id, school_code) values (p_device, p_code)
    on conflict (device_id, school_code) do nothing;
  select count(*) into total from school_requests where school_code = p_code;
  return total;
end;
$$;

revoke all on function request_school(uuid, text) from public;
grant execute on function request_school(uuid, text) to anon, authenticated;
