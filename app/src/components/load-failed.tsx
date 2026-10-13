import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  saved: boolean; // an earlier copy of the menu is on screen
  onRetry: () => void;
};

/** The menu request did not get through: say so in plain words, with a way to try again. */
export function LoadFailed({ saved, onRetry }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme.warnSoft }]}>
      <ThemedText type="small" style={[styles.text, { color: theme.warn }]}>
        {saved
          ? 'Chưa tải được thực đơn mới nhất, đang hiện bản đã lưu trên máy.'
          : 'Không tải được thực đơn. Bạn kiểm tra kết nối mạng rồi thử lại nhé.'}
      </ThemedText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { borderColor: theme.warn, opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: theme.warn }}>Thử lại</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  text: { flex: 1 },
  button: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});
