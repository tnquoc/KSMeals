import { Image } from 'expo-image';

/** The KSMeals app icon, with iOS-like rounded corners. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      accessibilityLabel="KSMeals"
    />
  );
}
