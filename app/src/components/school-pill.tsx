import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSchool } from '@/lib/school-store';

/** The chosen school as a button that clearly looks tappable; opens the profile to change it. */
export function SchoolPill() {
  const theme = useTheme();
  const { school } = useSchool();
  if (!school) return null;

  return (
    <Pressable
      onPress={() => router.navigate('/school')}
      accessibilityRole="button"
      accessibilityLabel={`Trường ${school.name}. Bấm để đổi trường`}
      style={({ pressed }) => [
        styles.pill,
        { borderColor: theme.accent, backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="small" numberOfLines={1} style={styles.name}>
        🏫 {school.name}
      </ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        Đổi ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    marginTop: Spacing.two,
  },
  name: { flexShrink: 1 },
});
