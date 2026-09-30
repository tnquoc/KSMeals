import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** ✕ inside the right end of a text box; the box needs right padding for it. */
export function ClearButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Xóa chữ đã gõ"
      hitSlop={8}
      style={[styles.clear, { backgroundColor: theme.border }]}>
      <ThemedText type="smallBold" style={styles.clearText}>✕</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clear: {
    position: 'absolute',
    right: Spacing.two + 2,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 12, lineHeight: 14 },
});
