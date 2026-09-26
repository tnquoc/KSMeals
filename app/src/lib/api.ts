/**
 * Read-only access to Supabase through its REST API with the publishable key.
 * Row level security only exposes active schools and published meals.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type Level = 'mn' | 'th' | 'thcs';
export type MealType = 'breakfast' | 'morning_snack' | 'lunch' | 'snack';

export type School = {
  id: number;
  code: string;
  name: string;
  level: Level;
  ward: string;
};

export type Nutrition = {
  kcal?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  unavailable?: boolean;
};

export type Meal = {
  date: string; // YYYY-MM-DD
  meal_type: MealType;
  dishes: string[];
  courses: string[];
  tray_image_urls: string[];
  nutrition: Nutrition | null;
  ai_note: string | null;
  allergens: string[];
  source_post_id: number | null;
};

export type SourcePost = {
  id: number;
  url: string;
  title: string;
  kind: 'menu' | 'tray';
  image_urls: string[]; // the school's original menu image(s)
  doc_urls: string[]; // or the menu as PDF/Word/Excel
};

async function get<T>(path: string): Promise<T> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in app/.env');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: PUBLISHABLE_KEY } });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function fetchSchools(): Promise<School[]> {
  return get('schools?select=id,code,name,level,ward&active=eq.true&order=name');
}

export function fetchMeals(schoolId: number, from: string, to: string): Promise<Meal[]> {
  return get(
    'meals?select=date,meal_type,dishes,courses,tray_image_urls,nutrition,ai_note,allergens,source_post_id' +
      `&school_id=eq.${schoolId}&date=gte.${from}&date=lte.${to}&order=date`,
  );
}

export async function fetchSources(ids: number[]): Promise<Record<number, SourcePost>> {
  if (!ids.length) return {};
  const filter = `id=in.(${ids.join(',')})`;
  const rows = await get<Omit<SourcePost, 'image_urls' | 'doc_urls'>[]>(`raw_posts?select=id,url,title,kind&${filter}`);
  // Media columns need migration 0005; without it the links still work.
  const media = await get<Pick<SourcePost, 'id' | 'image_urls' | 'doc_urls'>[]>(
    `raw_posts?select=id,image_urls,doc_urls&${filter}`,
  ).catch(() => []);
  const byId = Object.fromEntries(media.map((m) => [m.id, m]));
  return Object.fromEntries(
    rows.map((p) => [p.id, { ...p, image_urls: byId[p.id]?.image_urls ?? [], doc_urls: byId[p.id]?.doc_urls ?? [] }]),
  );
}
