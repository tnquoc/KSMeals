import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DayMenu } from '@/components/day-menu';
import { NoSchool } from '@/components/no-school';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMeals } from '@/hooks/use-meals';
import { useTheme } from '@/hooks/use-theme';
import { addDays, dayMonth, displayWeek, isSameDay, iso, mondayOf, weekDays, weekdayName } from '@/lib/dates';
import { DISCLAIMER } from '@/lib/labels';
import { useSchool } from '@/lib/school-store';

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.nav, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

export default function WeekScreen() {
  const theme = useTheme();
  const { school, loaded } = useSchool();
  const [today] = useState(() => new Date());
  const thisMonday = mondayOf(today);
  // null = automatic week (see displayWeek); set once the user navigates.
  const [chosen, setChosen] = useState<Date | null>(null);
  const from = chosen ?? thisMonday;
  const { meals, sources, loading, refreshing, error, reload } = useMeals(school?.id, from, addDays(from, chosen ? 4 : 11));

  if (!loaded) return <Screen>{null}</Screen>;
  if (!school) {
    return (
      <Screen>
        <NoSchool />
      </Screen>
    );
  }

  const auto = displayWeek(today, meals);
  const monday = chosen ?? auto.monday;
  const friday = addDays(monday, 4);

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <View>
        <ThemedText type="subtitle" style={styles.heading}>Cả tuần</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{school.name}</ThemedText>
      </View>

      <View style={styles.navRow}>
        <NavButton label="‹ Tuần trước" onPress={() => setChosen(addDays(monday, -7))} />
        <ThemedText type="smallBold" style={styles.range}>
          {dayMonth(monday)} – {dayMonth(friday)}
        </ThemedText>
        <NavButton label="Tuần sau ›" onPress={() => setChosen(addDays(monday, 7))} />
      </View>

      {!chosen && auto.fallback && !loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          Trường chưa đăng thực đơn tuần sau, đang hiện thực đơn tuần này.
        </ThemedText>
      ) : null}
      {error ? <ThemedText style={{ color: theme.warn }}>Không tải được thực đơn: {error}</ThemedText> : null}

      {loading ? <ActivityIndicator style={styles.spinner} /> : null}
      {!loading &&
        weekDays(monday).map((d) => (
          <View key={iso(d)} style={styles.day}>
            <ThemedText type="smallBold" style={isSameDay(d, today) ? { color: theme.accent } : undefined}>
              {weekdayName(d)} {dayMonth(d)}
              {isSameDay(d, today) ? ' · Hôm nay' : ''}
            </ThemedText>
            <DayMenu meals={meals.filter((m) => m.date === iso(d))} sources={sources} />
          </View>
        ))}
      <ThemedText type="small" themeColor="textSecondary">{DISCLAIMER}</ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 28, lineHeight: 36 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nav: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  range: { flex: 1, textAlign: 'center' },
  day: { gap: Spacing.two, marginTop: Spacing.two },
  spinner: { marginVertical: Spacing.five },
});
