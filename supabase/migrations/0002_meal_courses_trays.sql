-- Dish courses (món mặn / canh / xào...) for the app layout, and several tray photos per meal.
alter table meals add column if not exists courses text[] not null default '{}';  -- parallel to dishes
alter table meals add column if not exists tray_image_urls text[] not null default '{}';
alter table meals drop column if exists tray_image_url;
