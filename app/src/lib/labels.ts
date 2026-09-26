import type { ThemeColor } from '@/constants/theme';
import type { Level, MealType } from '@/lib/api';

export const LEVEL: Record<Level, string> = { mn: 'Mầm non', th: 'Tiểu học', thcs: 'THCS' };

export const MEAL: Record<MealType, string> = {
  breakfast: 'Bữa sáng',
  morning_snack: 'Bữa phụ sáng',
  lunch: 'Bữa trưa',
  snack: 'Bữa xế',
};
export const MEAL_ORDER: MealType[] = ['breakfast', 'morning_snack', 'lunch', 'snack'];

export const MEAL_ICON: Record<MealType, string> = {
  breakfast: '🌅',
  morning_snack: '🍎',
  lunch: '🍱',
  snack: '🍪',
};

/** Theme colors of each meal's header band: [text, background]. */
export const MEAL_TINT: Record<MealType, [ThemeColor, ThemeColor]> = {
  breakfast: ['mealBreakfast', 'mealBreakfastSoft'],
  morning_snack: ['mealMorningSnack', 'mealMorningSnackSoft'],
  lunch: ['mealLunch', 'mealLunchSoft'],
  snack: ['mealSnack', 'mealSnackSoft'],
};

export const COURSE: Record<string, string> = {
  staple: 'Món chính',
  main: 'Món mặn',
  soup: 'Canh',
  stir_fry: 'Xào',
  side: 'Món phụ',
  dessert: 'Tráng miệng',
  drink: 'Đồ uống',
  other: '',
};

// Decorative only: schools don't publish per-dish photos, so no fake food pictures.
export const COURSE_ICON: Record<string, string> = {
  staple: '🍚',
  main: '🍖',
  soup: '🍲',
  stir_fry: '🥬',
  side: '🥗',
  dessert: '🍉',
  drink: '🥛',
  other: '🍽️',
};

// Same ids as pipeline/allergens.py
export const ALLERGEN: Record<string, string> = {
  crustacean: 'Tôm, cua',
  mollusc: 'Mực, sò',
  fish: 'Cá',
  egg: 'Trứng',
  milk: 'Sữa',
  peanut: 'Đậu phộng',
  soy: 'Đậu nành',
  gluten: 'Lúa mì',
  sesame: 'Mè',
  tree_nut: 'Hạt',
};

/** Allergens of a meal that match the child's profile, split by dish and hidden ingredients. */
export function allergyHits(meal: { dishes: string[]; allergens: string[]; dish_allergens?: string[][] }, profile: string[]) {
  const perDish = meal.dishes.map((_, i) => (meal.dish_allergens?.[i] ?? []).filter((a) => profile.includes(a)));
  const inDishes = new Set(perDish.flat());
  const hidden = meal.allergens.filter((a) => profile.includes(a) && !inDishes.has(a));
  return { perDish, hidden, count: perDish.filter((h) => h.length).length + (hidden.length ? 1 : 0) };
}

export const allergenNames = (ids: string[]) => ids.map((a) => ALLERGEN[a] ?? a).join(', ');

export const DISCLAIMER =
  'Dinh dưỡng là ước tính bằng AI cho một suất ăn thông thường theo độ tuổi. ' +
  'Bột đường gồm cả tinh bột và đường (kể cả đường trong sữa, bánh ngọt). ' +
  'Nhãn vàng “Có thể chứa” là thành phần thường gây dị ứng, được dò theo tên món và nguyên liệu ' +
  'thường dùng, nên có thể thiếu hoặc thừa. Nếu con bị dị ứng, hãy xác nhận với nhà trường.';
