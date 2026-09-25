-- The app links each meal to the school's original post ("Xem bài gốc").
-- Expose only harmless columns of published posts; errors, image lists etc. stay private.
grant select (id, school_id, url, title, published_at, kind, status) on raw_posts to anon, authenticated;

create policy "public read published posts" on raw_posts
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from schools s where s.id = raw_posts.school_id and s.active)
  );
