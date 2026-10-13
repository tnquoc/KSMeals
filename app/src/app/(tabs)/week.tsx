import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DayMenu, MenuSources } from '@/components/day-menu';
import { LoadFailed } from '@/components/load-failed';
import { MenuNotes } from '@/components/menu-notes';
import { NoSchool } from '@/components/no-school';
import { PageHeader } from '@/components/page-header';
import { SchoolPill } from '@/components/school-pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMeals } from '@/hooks/use-meals';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { addDays, dayMonth, displayWeek, isSameDay, iso, mondayOf, weekDays, weekdayName } from '@/lib/dates';
import { allergyHits } from '@/lib/labels';
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
  const { school, loaded, allergies } = useSchool();
  const [today] = useState(() => new Date());
  const thisMonday = mondayOf(today);
  // null = automatic week (see displayWeek); set once the user navigates.
  const [chosen, setChosen] = useState<Date | null>(null);
  const from = chosen ?? thisMonday;
  const { meals, sources, loading, refreshing, failed, reload } = useMeals(school?.id, from, addDays(from, chosen ? 4 : 11));
  useEffect(() => {
    if (school) track('view_week', school.code, { offset: chosen ? Math.round((chosen.getTime() - thisMonday.getTime()) / 604800000) : 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school?.code, chosen]);

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
  // A post that several days were read from (the week's menu) is shown once under the week,
  // not again under each day; a post for a single day stays with its day.
  const daysOf: Record<number, Set<string>> = {};
  for (const m of meals) {
    if (m.source_post_id != null && m.date >= iso(monday) && m.date <= iso(friday)) {
      (daysOf[m.source_post_id] ??= new Set()).add(m.date);
    }
  }
  const weekPosts = Object.values(sources).filter((p) => (daysOf[p.id]?.size ?? 0) > 1);
  const daySources = Object.fromEntries(Object.entries(sources).filter(([, p]) => !weekPosts.includes(p)));

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <PageHeader title="Cả tuần">
        <SchoolPill />
      </PageHeader>

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
      {failed ? <LoadFailed saved={meals.length > 0} onRetry={reload} /> : null}

      {loading ? <ActivityIndicator style={styles.spinner} /> : null}
      {/* Nothing loaded is not "the school has not posted": only list the days once we know. */}
      {!loading &&
        !(failed && !meals.length) &&
        weekDays(monday).map((d) => {
          const dayMeals = meals.filter((m) => m.date === iso(d));
          const flagged = dayMeals.reduce((n, m) => n + allergyHits(m, allergies).count, 0);
          return (
            <View key={iso(d)} style={styles.day}>
              <ThemedText type="smallBold" style={isSameDay(d, today) ? { color: theme.accent } : undefined}>
                {weekdayName(d)} {dayMonth(d)}
                {isSameDay(d, today) ? ' · Hôm nay' : ''}
                {flagged ? <ThemedText type="smallBold" style={{ color: theme.danger }}>{`  ⛔ ${flagged} món cần chú ý`}</ThemedText> : null}
              </ThemedText>
              <DayMenu meals={dayMeals} sources={daySources} />
            </View>
          );
        })}
      {!loading && weekPosts.length ? (
        <View style={styles.day}>
          <MenuSources posts={weekPosts} title="Thực đơn gốc cả tuần của trường" />
        </View>
      ) : null}
      <MenuNotes />
    </Screen>
  );
}

const styles = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nav: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  range: { flex: 1, textAlign: 'center' },
  day: { gap: Spacing.two, marginTop: Spacing.two },
  spinner: { marginVertical: Spacing.five },
});
