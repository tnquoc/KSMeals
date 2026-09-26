import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/logo';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  title: ReactNode;
  children?: ReactNode; // shown under the title (school pill, subtitle...)
};

/** Screen title on the left, the KSMeals logo on the right. */
export function PageHeader({ title, children }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
        {children}
      </View>
      <Logo size={40} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 28, lineHeight: 36 },
});
