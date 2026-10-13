import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { NOTES } from '@/lib/labels';

/** What the numbers and alerts under a menu mean, as a short list. */
export function MenuNotes() {
  return (
    <View style={styles.list}>
      {NOTES.map((note) => (
        <View key={note} style={styles.item}>
          <ThemedText type="small" themeColor="textSecondary">•</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
            {note}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.one },
  item: { flexDirection: 'row', gap: Spacing.two },
  text: { flex: 1 },
});
