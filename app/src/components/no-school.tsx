import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function NoSchool() {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.box}>
      <ThemedText type="subtitle" style={styles.title}>Con bạn học trường nào?</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        Chọn trường để xem thực đơn bán trú mỗi ngày, kèm dinh dưỡng ước tính và nhãn dị ứng.
      </ThemedText>
      <Pressable
        onPress={() => router.navigate('/school')}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>Chọn trường</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.three, alignItems: 'center', marginTop: Spacing.five },
  title: { fontSize: 24, lineHeight: 32, textAlign: 'center' },
  center: { textAlign: 'center' },
  button: { borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
});
