-- Attachments (PDF/Word/Excel) separately from images, so the pipeline can re-download
-- whatever it needs from the database alone (GitHub Actions runners start empty).
alter table raw_posts add column if not exists doc_urls text[] not null default '{}';
