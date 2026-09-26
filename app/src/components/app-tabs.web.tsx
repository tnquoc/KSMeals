import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Hôm nay</TabButton>
          </TabTrigger>
          <TabTrigger name="week" href="/week" asChild>
            <TabButton>Cả tuần</TabButton>
          </TabTrigger>
          <TabTrigger name="ask" href="/ask" asChild>
            <TabButton>Hỏi AI</TabButton>
          </TabTrigger>
          <TabTrigger name="school" href="/school" asChild>
            <TabButton>Hồ sơ</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={isFocused ? 'backgroundSelected' : 'backgroundElement'} style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'accent' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  // Four tabs do not fit next to the brand on phone-width screens.
  const { width } = useWindowDimensions();
  const wide = width >= 520;
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, !wide && styles.innerNarrow]}>
        {wide ? (
          <ThemedText type="smallBold" style={styles.brandText}>
            KSMeals
          </ThemedText>
        ) : null}
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: { marginRight: 'auto' },
  innerNarrow: { justifyContent: 'space-between', paddingHorizontal: Spacing.two, gap: 0 },
  pressed: { opacity: 0.7 },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
