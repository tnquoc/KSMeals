import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { track } from '@/lib/analytics';
import type { Meal, School } from '@/lib/api';
import { menuText, shareText } from '@/lib/share';

export function ShareButton({ school, day, meals }: { school: School; day: Date; meals: Meal[] }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const onPress = async () => {
    const how = await shareText(menuText(school, day, meals)).catch(() => 'cancelled' as const);
    if (how !== 'cancelled') track('share', school.code, { how });
    if (how === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { borderColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        {copied ? '✓ Đã sao chép, dán vào Zalo nhé' : '📤 Chia sẻ thực đơn ngày này'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
