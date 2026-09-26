-- Street address from the school's website footer, so parents can tell apart schools with the
-- same name in different wards. Readable by the app through the existing select grant on schools.
alter table schools add column if not exists address text;
