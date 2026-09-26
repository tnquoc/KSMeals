/** Share a day's menu as plain text (for Zalo class groups), with a link that opens the same school. */
import { Platform, Share } from 'react-native';

import type { Meal, School } from '@/lib/api';
import { WEB_URL } from '@/lib/app-info';
import { dayMonth, weekdayName } from '@/lib/dates';
import { MEAL, MEAL_ORDER } from '@/lib/labels';

export function schoolLink(school: School) {
  return `${WEB_URL}/?school=${encodeURIComponent(school.code)}`;
}

export function menuText(school: School, day: Date, meals: Meal[]) {
  const lines = [`🍱 Thực đơn bán trú ${weekdayName(day)} ${dayMonth(day)}`, `🏫 ${school.name}`, ''];
  const sorted = [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type));
  for (const m of sorted) {
    if (m.dishes.length) lines.push(`${MEAL[m.meal_type] ?? m.meal_type}: ${m.dishes.join(', ')}`);
  }
  if (!sorted.some((m) => m.dishes.length)) lines.push('Trường chưa đăng thực đơn ngày này.');
  lines.push('', 'Xem cả tuần, dinh dưỡng và cảnh báo dị ứng trên KSMeals:', schoolLink(school));
  return lines.join('\n');
}

/** Returns how it was shared: the system share sheet, or copied to the clipboard (desktop web). */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.share) {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch {
        return 'cancelled';
      }
    }
    await nav?.clipboard?.writeText(message);
    return 'copied';
  }
  const result = await Share.share({ message });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
