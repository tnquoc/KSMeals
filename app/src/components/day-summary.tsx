import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Meal } from '@/lib/api';
import { weekdayName } from '@/lib/dates';
import { allergyHits, MEAL, MEAL_ICON, MEAL_ORDER } from '@/lib/labels';

// Dishes worth naming in one line: the "what's for lunch" answer, not rice or water.
const HEADLINE_COURSES = ['main', 'stir_fry', 'soup', 'staple'];

/** One line on top of the day: what the child eats at lunch, the day's energy, allergy hits. */
export function DaySummary({ meals, day, isToday, allergies }: { meals: Meal[]; day: Date; isToday: boolean; allergies: string[] }) {
  const theme = useTheme();
  const withDishes = meals.filter((m) => m.dishes.length);
  const meal =
    withDishes.find((m) => m.meal_type === 'lunch') ??
    [...withDishes].sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type))[0];
  if (!meal) return null;

  const ranked = meal.dishes
    .map((dish, i) => ({ dish, rank: HEADLINE_COURSES.indexOf(meal.courses[i]) }))
    .filter((d) => d.rank >= 0)
    .sort((a, b) => a.rank - b.rank);
  const headline = (ranked.length ? ranked.map((d) => d.dish) : meal.dishes).slice(0, 2).join(' · ');
  const when =
    meal.meal_type === 'lunch' ? (isToday ? 'Trưa nay' : `Trưa ${weekdayName(day)}`) : `${MEAL[meal.meal_type]}${isToday ? ' hôm nay' : ''}`;
  const kcal = meals.reduce((sum, m) => sum + (m.nutrition?.kcal ?? 0), 0);
  const flagged = meals.reduce((sum, m) => sum + allergyHits(m, allergies).count, 0);

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText style={styles.icon}>{MEAL_ICON[meal.meal_type]}</ThemedText>
      <View style={styles.text}>
        <ThemedText type="small" themeColor="textSecondary">
          {when} con ăn
        </ThemedText>
        <ThemedText style={styles.headline}>{headline}</ThemedText>
        <View style={styles.facts}>
          {kcal ? (
            <ThemedText type="small" themeColor="textSecondary">
              {withDishes.length} bữa ở trường · ~{Math.round(kcal).toLocaleString('vi-VN')} kcal
            </ThemedText>
          ) : null}
          {flagged ? (
            <ThemedText type="smallBold" style={{ color: theme.danger }}>
              ⛔ {flagged} món cần chú ý
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  icon: { fontSize: 36, lineHeight: 44 },
  text: { flex: 1, gap: 2 },
  headline: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three },
});
