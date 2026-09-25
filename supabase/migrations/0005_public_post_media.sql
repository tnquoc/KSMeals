-- The app shows the school's original menu image/file next to the extracted menu.
-- These URLs are already public on the school websites; RLS still limits rows to
-- published posts of active schools (policy from 0004).
grant select (image_urls, doc_urls) on raw_posts to anon, authenticated;
