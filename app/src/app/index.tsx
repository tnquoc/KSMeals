import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DayMenu } from '@/components/day-menu';
import { NoSchool } from '@/components/no-school';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWeekMeals } from '@/hooks/use-week-meals';
import { dayMonth, defaultSchoolDay, isSameDay, iso, schoolWeekStart, weekDays, weekdayName, weekdayShort } from '@/lib/dates';
import { DISCLAIMER } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

export default function TodayScreen() {
  const theme = useTheme();
  const { school, loaded } = useSchool();
  const [monday] = useState(() => schoolWeekStart());
  const [selected, setSelected] = useState(() => defaultSchoolDay());
  const { meals, sources, loading, refreshing, error, reload } = useWeekMeals(school?.id, monday);
  const today = new Date();

  if (!loaded) return <Screen>{null}</Screen>;
  if (!school) {
    return (
      <Screen>
        <NoSchool />
      </Screen>
    );
  }

  const heading = isSameDay(selected, today) ? 'Hôm nay' : weekdayName(selected);

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View>
        <ThemedText type="subtitle" style={styles.heading}>
          {heading} <ThemedText type="subtitle" themeColor="textSecondary" style={styles.heading}>{dayMonth(selected)}</ThemedText>
        </ThemedText>
        <Pressable onPress={() => router.navigate('/school')}>
          <ThemedText type="small" themeColor="textSecondary">{school.name} · Đổi trường</ThemedText>
        </Pressable>
      </View>

      <View style={styles.strip}>
        {weekDays(monday).map((d) => {
          const on = isSameDay(d, selected);
          const hasMenu = meals.some((m) => m.date === iso(d) && m.dishes.length);
          return (
            <Pressable
              key={iso(d)}
              onPress={() => setSelected(d)}
              style={[styles.day, { backgroundColor: on ? theme.accent : theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="smallBold" style={{ color: on ? theme.onAccent : theme.text }}>{weekdayShort(d)}</ThemedText>
              <ThemedText type="small" style={{ color: on ? theme.onAccent : theme.textSecondary }}>{dayMonth(d)}</ThemedText>
              <View style={[styles.dot, { backgroundColor: hasMenu ? (on ? theme.onAccent : theme.accent) : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      {error ? <ThemedText style={{ color: theme.warn }}>Không tải được thực đơn: {error}</ThemedText> : null}
      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <DayMenu meals={meals.filter((m) => m.date === iso(selected))} sources={sources} />
      )}
      <ThemedText type="small" themeColor="textSecondary">{DISCLAIMER}</ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 28, lineHeight: 36 },
  strip: { flexDirection: 'row', gap: Spacing.two },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  spinner: { marginVertical: Spacing.five },
});
