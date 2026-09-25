import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { MealCard } from '@/components/meal-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Meal, SourcePost } from '@/lib/api';
import { MEAL_ORDER } from '@/lib/labels';

type Props = {
  meals: Meal[]; // meals of this day only
  sources: Record<number, SourcePost>;
};

export function DayMenu({ meals, sources }: Props) {
  const sorted = [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type));
  const posts = [...new Set(meals.map((m) => m.source_post_id))]
    .map((id) => (id != null ? sources[id] : undefined))
    .filter((p): p is SourcePost => !!p);

  if (!sorted.length) {
    return (
      <ThemedView type="backgroundElement" style={styles.empty}>
        <ThemedText themeColor="textSecondary">Trường chưa đăng thực đơn ngày này.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <View style={styles.list}>
      {sorted.map((m) => (
        <MealCard key={`${m.date}-${m.meal_type}`} meal={m} />
      ))}
      {posts.map((p) => (
        <ExternalLink key={p.id} href={p.url as Href & string}>
          <ThemedText type="linkPrimary">Xem bài gốc của trường ↗</ThemedText>
        </ExternalLink>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  empty: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
  },
});
