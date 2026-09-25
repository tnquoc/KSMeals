import { Image } from 'expo-image';
import { openBrowserAsync } from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Meal } from '@/lib/api';
import { ALLERGEN, COURSE, MEAL } from '@/lib/labels';

export function MealCard({ meal }: { meal: Meal }) {
  const theme = useTheme();
  const n = meal.nutrition;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
        {MEAL[meal.meal_type] ?? meal.meal_type}
      </ThemedText>

      {meal.dishes.map((dish, i) => (
        <View key={`${dish}-${i}`} style={styles.dish}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.course}>
            {COURSE[meal.courses[i]] ?? ''}
          </ThemedText>
          <ThemedText style={styles.dishName}>{dish}</ThemedText>
        </View>
      ))}

      {n?.kcal ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.nutrition}>
          <ThemedText type="smallBold">~{Math.round(n.kcal)} kcal</ThemedText>
          {`  ·  Đạm ${Math.round(n.protein_g ?? 0)}g  ·  Béo ${Math.round(n.fat_g ?? 0)}g  ·  Bột đường ${Math.round(n.carbs_g ?? 0)}g`}
        </ThemedText>
      ) : null}

      {meal.ai_note ? <ThemedText type="small" style={styles.note}>{meal.ai_note}</ThemedText> : null}

      {meal.allergens.length ? (
        <View style={styles.chips}>
          {meal.allergens.map((a) => (
            <View key={a} style={[styles.chip, { backgroundColor: theme.warnSoft }]}>
              <ThemedText type="smallBold" style={{ color: theme.warn, fontSize: 12 }}>
                {ALLERGEN[a] ?? a}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {meal.tray_image_urls.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trays}>
          {meal.tray_image_urls.map((url) => (
            <Pressable key={url} onPress={() => openBrowserAsync(url)} accessibilityLabel="Xem ảnh khay ăn">
              <Image source={url} style={[styles.tray, { borderColor: theme.border }]} contentFit="cover" transition={150} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
    marginBottom: Spacing.one,
  },
  dish: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  course: {
    width: 84,
    fontSize: 12,
  },
  dishName: {
    flex: 1,
  },
  nutrition: {
    marginTop: Spacing.two,
  },
  note: {
    marginTop: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  trays: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  tray: {
    width: 104,
    height: 78,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
