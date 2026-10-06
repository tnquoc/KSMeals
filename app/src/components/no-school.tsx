import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { SchoolPicker } from '@/components/school-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSchools } from '@/hooks/use-schools';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import { useSchool } from '@/lib/school-store';

const DEFAULT_MESSAGE = 'Chọn trường để xem thực đơn bán trú mỗi ngày, kèm dinh dưỡng ước tính và nhãn dị ứng.';

/** Other tabs before a school is chosen: a card with a button to the picker. */
export function NoSchool({ message = DEFAULT_MESSAGE }: { message?: string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.box, styles.spaced]}>
      <ThemedText type="subtitle" style={styles.title}>Con bạn học trường nào?</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      <Pressable
        onPress={() => router.navigate('/school')}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>Chọn trường</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

/** First screen of a new parent: search and the covered schools right away, no extra tap. */
export function SchoolStart() {
  const { setSchool } = useSchool();
  const { schools, error } = useSchools();
  return (
    <>
      <ThemedView type="backgroundElement" style={styles.box}>
        <ThemedText type="subtitle" style={styles.title}>Con bạn học trường nào?</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Tìm trường của con để xem thực đơn bán trú mỗi ngày, kèm dinh dưỡng ước tính và nhãn dị ứng.
        </ThemedText>
      </ThemedView>
      <SchoolPicker
        source="home"
        schools={schools}
        error={error}
        onChoose={(s) => {
          setSchool(s);
          track('school_selected', s.code, { from: 'home' });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.three, alignItems: 'center' },
  spaced: { marginTop: Spacing.five },
  title: { fontSize: 24, lineHeight: 32, textAlign: 'center' },
  center: { textAlign: 'center' },
  button: { borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
});
