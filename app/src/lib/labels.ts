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
  'Nhãn dị ứng được dò theo tên món và nguyên liệu thường dùng, có thể thiếu hoặc thừa. ' +
  'Hãy xác nhận với nhà trường.';
