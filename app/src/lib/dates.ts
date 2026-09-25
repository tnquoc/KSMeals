/** Local-date helpers. Dates travel as YYYY-MM-DD strings, like in the database. */
import type { Meal } from '@/lib/api';

export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Monday of the calendar week containing d (Sunday belongs to the week before). */
export function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

/**
 * Which school week to show by default. Weekdays: this week. Weekends: next week if the
 * school already posted it, otherwise this week (so parents don't land on an empty screen).
 */
export function displayWeek(today: Date, meals: Meal[]): { monday: Date; fallback: boolean } {
  const thisMonday = mondayOf(today);
  if (!isWeekend(today)) return { monday: thisMonday, fallback: false };
  const next = addDays(thisMonday, 7);
  const nextPosted = meals.some((m) => m.dishes.length && m.date >= iso(next) && m.date <= iso(addDays(next, 4)));
  return nextPosted ? { monday: next, fallback: false } : { monday: thisMonday, fallback: true };
}

export function weekDays(monday: Date): Date[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const weekdayName = (d: Date) => WEEKDAY[d.getDay()];
export const weekdayShort = (d: Date) => WEEKDAY_SHORT[d.getDay()];
export const dayMonth = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
export const isSameDay = (a: Date, b: Date) => iso(a) === iso(b);
