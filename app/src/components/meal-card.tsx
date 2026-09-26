import { Image } from 'expo-image';
import { openBrowserAsync } from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Meal, Nutrition } from '@/lib/api';
import { ALLERGEN, allergenNames, allergyHits, COURSE, COURSE_ICON, MEAL, MEAL_ICON, MEAL_TINT } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

/** Share of the meal's energy from protein, fat and carbs, with grams as direct labels. */
function MacroBar({ n }: { n: Nutrition }) {
  const theme = useTheme();
  const parts = [
    { label: 'Đạm', grams: n.protein_g ?? 0, kcal: (n.protein_g ?? 0) * 4, color: theme.protein },
    { label: 'Béo', grams: n.fat_g ?? 0, kcal: (n.fat_g ?? 0) * 9, color: theme.fat },
    { label: 'Bột đường', grams: n.carbs_g ?? 0, kcal: (n.carbs_g ?? 0) * 4, color: theme.carbs },
  ];
  const total = parts.reduce((sum, p) => sum + p.kcal, 0);
  if (!total) return null;

  return (
    <View style={styles.macros} accessibilityLabel={parts.map((p) => `${p.label} ${Math.round(p.grams)} gam`).join(', ')}>
      <View style={styles.bar}>
        {parts.map((p) =>
          p.kcal ? <View key={p.label} style={[styles.segment, { flex: p.kcal, backgroundColor: p.color }]} /> : null,
        )}
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.label} style={styles.legendItem}>
            <View style={styles.legendName}>
              <View style={[styles.legendDot, { backgroundColor: p.color }]} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
                {p.label}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={styles.legendText}>
              {Math.round(p.grams)}g{' '}
              <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
                · {Math.round((p.kcal / total) * 100)}%
              </ThemedText>
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

export function MealCard({ meal }: { meal: Meal }) {
  const theme = useTheme();
  const { allergies } = useSchool();
  const n = meal.nutrition;
  const hits = allergyHits(meal, allergies);
  const [tint, tintSoft] = MEAL_TINT[meal.meal_type] ?? ['textSecondary', 'backgroundSelected'];

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={[styles.header, { backgroundColor: theme[tintSoft] }]}>
        <ThemedText style={styles.mealIcon}>{MEAL_ICON[meal.meal_type] ?? '🍽️'}</ThemedText>
        <ThemedText type="smallBold" style={[styles.title, { color: theme[tint] }]}>
          {MEAL[meal.meal_type] ?? meal.meal_type}
        </ThemedText>
        {n?.kcal ? <ThemedText type="smallBold">~{Math.round(n.kcal)} kcal</ThemedText> : null}
      </View>
      <View style={styles.body}>

        {meal.dishes.map((dish, i) => {
          const danger = hits.perDish[i];
          return (
            <View
              key={`${dish}-${i}`}
              style={[styles.dish, danger.length ? [styles.dangerDish, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }] : null]}>
              <ThemedText style={styles.icon}>{COURSE_ICON[meal.courses[i]] ?? COURSE_ICON.other}</ThemedText>
              <View style={styles.dishText}>
                <ThemedText style={[styles.dishName, danger.length ? { color: theme.danger, fontWeight: 700 } : null]}>{dish}</ThemedText>
                {danger.length ? (
                  <ThemedText type="smallBold" style={[styles.course, { color: theme.danger }]}>
                    ⛔ Có thể chứa {allergenNames(danger)}
                  </ThemedText>
                ) : COURSE[meal.courses[i]] ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.course}>
                    {COURSE[meal.courses[i]]}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          );
        })}
        {hits.hidden.length ? (
          <View style={[styles.hidden, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
            <ThemedText type="smallBold" style={{ color: theme.danger }}>
              ⛔ Bữa này có thể có {allergenNames(hits.hidden)} trong nguyên liệu (không rõ món nào)
            </ThemedText>
          </View>
        ) : null}
        {!meal.dishes.length ? (
          <ThemedText type="small" themeColor="textSecondary">Trường chỉ đăng ảnh, chưa có thực đơn dạng chữ.</ThemedText>
        ) : null}

        {n?.kcal ? <MacroBar n={n} /> : null}

        {meal.ai_note ? <ThemedText type="small" style={styles.note}>{meal.ai_note}</ThemedText> : null}

        {meal.allergens.length ? (
          <View style={styles.chips}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.chipsLabel}>
              ⚠️ Có thể chứa:
            </ThemedText>
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
          <ThemedText type="small" themeColor="textSecondary" style={styles.traysLabel}>
            📷 Ảnh suất ăn thực tế do trường chụp
          </ThemedText>
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
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  mealIcon: {
    fontSize: 18,
    lineHeight: 24,
  },
  title: {
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 13,
  },
  body: {
    padding: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  dish: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: 2,
  },
  icon: {
    fontSize: 20,
    lineHeight: 26,
    width: 28,
    textAlign: 'center',
  },
  dishText: {
    flex: 1,
  },
  dishName: {
    lineHeight: 22,
  },
  dangerDish: {
    borderLeftWidth: 3,
    borderRadius: Spacing.two,
    marginHorizontal: -Spacing.two,
    paddingHorizontal: Spacing.two - 3,
    paddingVertical: Spacing.one,
  },
  hidden: {
    borderLeftWidth: 3,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    marginTop: Spacing.one,
  },
  course: {
    fontSize: 12,
    lineHeight: 16,
  },
  macros: {
    marginTop: Spacing.two,
    gap: Spacing.one + 2,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    gap: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  legendItem: {
    flex: 1,
  },
  legendName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 13,
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
  chipsLabel: {
    fontSize: 12,
    alignSelf: 'center',
  },
  traysLabel: {
    fontSize: 12,
    marginTop: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  trays: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  tray: {
    width: 104,
    height: 78,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
