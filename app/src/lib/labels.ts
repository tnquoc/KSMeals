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

const starts = (words: string) => new RegExp(`^(?:${words})(?![\\p{L}])`, 'u');
const has = (words: string) => new RegExp(`(?:^|[^\\p{L}])(?:${words})(?![\\p{L}])`, 'u');

// What the dish is, read from how its name starts ("Mì trứng nấu thịt heo" is noodles, not rice).
const BASE_ICON: [RegExp, string][] = [
  [starts('mì ý|mì spaghetti|spaghetti'), '🍝'],
  [starts('mì|mỳ|bún|phở|hủ tiếu|hủ tíu|hủ tiểu|miến|nui|bánh canh|bánh đa|hoành thánh'), '🍜'],
  [starts('cháo|súp|soup'), '🥣'],
  [starts('cơm|xôi'), '🍚'],
  [starts('bánh mì|hamburger|bánh hotdog'), '🥖'],
  [starts('bánh bao|há cảo|sủi cảo'), '🥟'],
  [starts('bánh flan|bánh plan|kem flan|kem plan|bánh pudding|pudding|rau câu|thạch'), '🍮'],
  [starts('bánh quy|bánh xốp|bánh quế|bánh gạo|bánh nabati|bánh chocopie'), '🍪'],
  [starts('bánh bông lan|bánh kem|bánh ngọt|bánh su|bánh pía|bánh trung thu|bánh dorayaki|bánh paparotti'), '🍰'],
  [starts('kem'), '🍦'],
  [starts('sữa|yaourt|yogurt|yakult'), '🥛'],
  [starts('nước(?! lèo| dùng| mắm)|sinh tố|trà'), '🥤'],
  [starts('canh'), '🍲'],
  [starts('phô mai|phomai|pho mai'), '🧀'],
];
// Món mặn: the first meat or fish named ("Bò sốt cá hộp" is beef).
const PROTEIN_ICON: [RegExp, string][] = [
  [has('cá'), '🐟'],
  [has('tôm'), '🍤'],
  [has('cua|ghẹ'), '🦀'],
  [has('mực'), '🦑'],
  [has('thịt gà|gà|vịt'), '🍗'],
  [has('trứng'), '🍳'],
  [has('thịt bò|bò'), '🥩'],
  [has('đậu hũ|đậu hủ|tàu hũ|đậu phụ'), '🥘'],
  [has('thịt|heo|sườn|xíu mại'), '🍖'],
];
const VEGETABLE_ICON: [RegExp, string][] = [
  [starts('bông cải|súp lơ'), '🥦'],
  [starts('cà rốt'), '🥕'],
  [starts('khoai tây'), '🥔'],
  [starts('khoai lang|khoai mỡ|khoai môn'), '🍠'],
  [starts('bắp(?! cải)|ngô'), '🌽'],
  [starts('bí đỏ'), '🎃'],
  [starts('nấm'), '🍄'],
  [starts('trứng'), '🥚'],
];
const FRUIT_ICON: [RegExp, string][] = [
  [starts('chuối'), '🍌'],
  [starts('dưa hấu'), '🍉'],
  [starts('dưa lưới|dưa gang'), '🍈'],
  [starts('táo'), '🍎'],
  [starts('nho'), '🍇'],
  [starts('cam|quýt'), '🍊'],
  [starts('lê'), '🍐'],
  [starts('xoài'), '🥭'],
  [starts('thơm|khóm|dứa'), '🍍'],
  [starts('dâu'), '🍓'],
];
const BY_COURSE: Record<string, [RegExp, string][]> = {
  stir_fry: VEGETABLE_ICON,
  side: [...VEGETABLE_ICON, ...FRUIT_ICON],
  dessert: FRUIT_ICON,
  other: FRUIT_ICON,
};

/** Icon of one dish: from its name where that is clear, otherwise from its course. Decorative only. */
export function dishIcon(dish: string, course: string): string {
  // "Món mặn: Chả sò điệp" -> "chả sò điệp"
  const name = dish.toLowerCase().normalize('NFC').replace(/^[^:]{0,14}:\s*/, '').replace(/^[^\p{L}]+/u, '');
  const base = BASE_ICON.find(([re]) => re.test(name));
  if (base) return base[1];
  if (course === 'main') {
    const found = PROTEIN_ICON.map(([re, icon]) => ({ at: name.search(re), icon })).filter((p) => p.at >= 0);
    if (found.length) return found.reduce((a, b) => (b.at < a.at ? b : a)).icon;
  }
  const specific = BY_COURSE[course]?.find(([re]) => re.test(name));
  return specific?.[1] ?? COURSE_ICON[course] ?? COURSE_ICON.other;
}

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

/** Lowercase without diacritics: "le van si" finds "Lê Văn Sĩ". */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const hasMarks = (s: string) => fold(s) !== s.toLowerCase();
// Words parents add in front of the thing itself: "thịt vịt" should also find "bún măng vịt".
const GENERIC = /^(thịt|con|trái|quả|món|thit|trai|qua|mon)\s+/i;

/**
 * Matcher for an allergy the parent typed (not one of the 10 groups). Whole words only.
 * Typed with diacritics: exact ("cá" must not match "cà"); typed without: diacritics ignored.
 */
export function customMatcher(term: string): (text: string) => boolean {
  const core = term.trim().toLowerCase().normalize('NFC').replace(GENERIC, '');
  const exact = hasMarks(core);
  const needle = exact ? core : fold(core);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, 'u');
  return (text) => re.test(exact ? text.toLowerCase().normalize('NFC') : fold(text));
}

export const isCustomAllergy = (a: string) => !(a in ALLERGEN);

/**
 * Allergens of a meal that match the child's profile, split by dish and hidden ingredients.
 * The profile holds group ids (ALLERGEN) and free-text terms the parent typed ("thịt vịt"),
 * which are looked up in dish names and the meal's usual ingredients.
 */
export function allergyHits(
  meal: { dishes: string[]; allergens: string[]; dish_allergens?: string[][]; ingredients?: string[] | null },
  profile: string[],
) {
  const custom = profile.filter(isCustomAllergy).map((t) => ({ term: t, match: customMatcher(t) }));
  const perDish = meal.dishes.map((dish, i) => [
    ...(meal.dish_allergens?.[i] ?? []).filter((a) => profile.includes(a)),
    ...custom.filter((c) => c.match(dish)).map((c) => c.term),
  ]);
  const inDishes = new Set(perDish.flat());
  const hidden = [
    ...meal.allergens.filter((a) => profile.includes(a) && !inDishes.has(a)),
    ...custom.filter((c) => !inDishes.has(c.term) && (meal.ingredients ?? []).some(c.match)).map((c) => c.term),
  ];
  return { perDish, hidden, count: perDish.filter((h) => h.length).length + (hidden.length ? 1 : 0) };
}

export const allergenNames = (ids: string[]) => ids.map((a) => ALLERGEN[a] ?? a).join(', ');

/** Shown under every menu, one line each. */
export const NOTES = [
  'Dinh dưỡng là ước tính bằng AI cho một suất ăn theo độ tuổi.',
  'Bột đường gồm cả tinh bột và đường (kể cả trong sữa, bánh ngọt).',
  'Cảnh báo dị ứng dò theo tên món và nguyên liệu thường dùng nên có thể thiếu hoặc thừa. Hãy xác nhận với nhà trường.',
];
