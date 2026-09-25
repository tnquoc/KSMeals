/** Local-date helpers. Dates travel as YYYY-MM-DD strings, like in the database. */

export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Monday of the school week to show: this week on weekdays, next week on weekends. */
export function schoolWeekStart(today: Date = new Date()): Date {
  const wd = today.getDay(); // 0 = Sunday
  const shift = wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd;
  return addDays(today, shift);
}

/** The school day to open on: today, or next Monday on weekends. */
export function defaultSchoolDay(today: Date = new Date()): Date {
  const wd = today.getDay();
  return wd === 0 || wd === 6 ? schoolWeekStart(today) : new Date(today.getFullYear(), today.getMonth(), today.getDate());
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
