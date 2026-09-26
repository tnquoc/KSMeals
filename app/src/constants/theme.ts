/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C2430',
    background: '#F6F7F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6F4EC',
    textSecondary: '#677386',
    border: '#E3E7EE',
    accent: '#1F7A4D',
    onAccent: '#FFFFFF',
    warn: '#9A5B00',
    warnSoft: '#FFF4E0',
    danger: '#B3261E',
    dangerSoft: '#FDECEA',
    // One tint per meal (header band of each meal card)
    mealBreakfast: '#B45309',
    mealBreakfastSoft: '#FFF1DC',
    mealMorningSnack: '#BE185D',
    mealMorningSnackSoft: '#FCE7F1',
    mealLunch: '#1F7A4D',
    mealLunchSoft: '#E3F3EA',
    mealSnack: '#4338CA',
    mealSnackSoft: '#ECEEFF',
    // Macro split bar (validated categorical slots 1–3)
    protein: '#2A78D6',
    fat: '#EB6834',
    carbs: '#1BAF7A',
  },
  dark: {
    text: '#E6E9EE',
    background: '#12161C',
    backgroundElement: '#1B2129',
    backgroundSelected: '#1D3328',
    textSecondary: '#97A2B3',
    border: '#2C3440',
    accent: '#5CC58E',
    onAccent: '#0E1A13',
    warn: '#F0B35A',
    warnSoft: '#3A2D17',
    danger: '#F28B82',
    dangerSoft: '#3B1F1D',
    mealBreakfast: '#F5B971',
    mealBreakfastSoft: '#33271A',
    mealMorningSnack: '#F29BC1',
    mealMorningSnackSoft: '#351F2A',
    mealLunch: '#5CC58E',
    mealLunchSoft: '#1D3328',
    mealSnack: '#A5B4FC',
    mealSnackSoft: '#252A45',
    protein: '#3987E5',
    fat: '#D95926',
    carbs: '#199E70',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 90 }) ?? 0;
export const MaxContentWidth = 800;
