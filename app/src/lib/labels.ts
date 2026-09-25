import type { Level, MealType } from '@/lib/api';

export const LEVEL: Record<Level, string> = { mn: 'Mầm non', th: 'Tiểu học', thcs: 'THCS' };

export const MEAL: Record<MealType, string> = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', snack: 'Bữa xế' };
export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack'];

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

export const DISCLAIMER =
  'Dinh dưỡng là ước tính bằng AI cho một suất ăn thông thường theo độ tuổi. ' +
  'Nhãn vàng “Có thể chứa” là thành phần thường gây dị ứng, được dò theo tên món và nguyên liệu ' +
  'thường dùng, nên có thể thiếu hoặc thừa. Nếu con bị dị ứng, hãy xác nhận với nhà trường.';
