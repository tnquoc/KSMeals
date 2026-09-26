import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DayMenu } from '@/components/day-menu';
import { NoSchool } from '@/components/no-school';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMeals } from '@/hooks/use-meals';
import { useTheme } from '@/hooks/use-theme';
import {
  addDays,
  dayMonth,
  displayWeek,
  isSameDay,
  isWeekend,
  iso,
  mondayOf,
  weekDays,
  weekdayName,
  weekdayShort,
} from '@/lib/dates';
import { allergyHits, DISCLAIMER } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

export default function TodayScreen() {
  const theme = useTheme();
  const { school, loaded, allergies } = useSchool();
  const [today] = useState(() => new Date());
  const thisMonday = mondayOf(today);
  // This week and next week in one request; which one to show depends on what is posted.
  const { meals, sources, loading, refreshing, error, reload } = useMeals(school?.id, thisMonday, addDays(thisMonday, 11));
  const [picked, setPicked] = useState<Date | null>(null);

  if (!loaded) return <Screen>{null}</Screen>;
  if (!school) {
    return (
      <Screen>
        <NoSchool />
      </Screen>
    );
  }

  const { monday, fallback } = displayWeek(today, meals);
  const days = weekDays(monday);
  const defaultDay = !isWeekend(today) ? today : fallback ? days[4] : days[0];
  const selected = picked && days.some((d) => isSameDay(d, picked)) ? picked : defaultDay;
  const heading = isSameDay(selected, today) ? 'Hôm nay' : weekdayName(selected);

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View>
        <ThemedText type="subtitle" style={styles.heading}>
          {heading}{' '}
          <ThemedText type="subtitle" themeColor="textSecondary" style={styles.heading}>
            {dayMonth(selected)}
          </ThemedText>
        </ThemedText>
        <Pressable onPress={() => router.navigate('/school')}>
          <ThemedText type="small" themeColor="textSecondary">{school.name} · Đổi trường</ThemedText>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <>
          {fallback ? (
            <ThemedText type="small" themeColor="textSecondary">
              Trường chưa đăng thực đơn tuần sau, đang hiện thực đơn tuần này.
            </ThemedText>
          ) : null}
          <View style={styles.strip}>
            {days.map((d) => {
              const on = isSameDay(d, selected);
              const dayMeals = meals.filter((m) => m.date === iso(d));
              const hasMenu = dayMeals.some((m) => m.dishes.length || m.tray_image_urls.length);
              const warn = dayMeals.some((m) => allergyHits(m, allergies).count > 0);
              return (
                <Pressable
                  key={iso(d)}
                  onPress={() => setPicked(d)}
                  style={[styles.day, { backgroundColor: on ? theme.accent : theme.backgroundElement, borderColor: theme.border }]}>
                  <ThemedText type="smallBold" style={{ color: on ? theme.onAccent : theme.text }}>{weekdayShort(d)}</ThemedText>
                  <ThemedText type="small" style={{ color: on ? theme.onAccent : theme.textSecondary }}>{dayMonth(d)}</ThemedText>
                  {warn ? (
                    <ThemedText style={styles.warn}>⚠️</ThemedText>
                  ) : (
                    <View style={[styles.dot, { backgroundColor: hasMenu ? (on ? theme.onAccent : theme.accent) : 'transparent' }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
          {error ? <ThemedText style={{ color: theme.warn }}>Không tải được thực đơn: {error}</ThemedText> : null}
          <DayMenu meals={meals.filter((m) => m.date === iso(selected))} sources={sources} />
        </>
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
  warn: { fontSize: 10, lineHeight: 12 },
  spinner: { marginVertical: Spacing.five },
});
