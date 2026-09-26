-- Allergens per dish, parallel to `dishes` (e.g. [[], ["crustacean"], ["soy"]]), detected by keyword.
-- The chatbot and the app need to know WHICH dish may contain an allergen, not just the meal.
alter table meals add column if not exists dish_allergens jsonb not null default '[]';
