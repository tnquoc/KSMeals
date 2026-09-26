import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { track } from '@/lib/analytics';
import { SchoolProvider, useSchool } from '@/lib/school-store';

SplashScreen.preventAutoHideAsync();

function WhenProfileLoaded() {
  const { loaded, school } = useSchool();
  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
    track('app_open', school?.code);
    // Once per launch, as soon as the saved profile is read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Web: keep the tab title once the router takes over <head> */}
      <Head>
        <title>KSMeals · Thực đơn bán trú</title>
      </Head>
      <SchoolProvider>
        <WhenProfileLoaded />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="privacy" options={{ title: 'Quyền riêng tư', headerBackTitle: 'Quay lại' }} />
        </Stack>
      </SchoolProvider>
    </ThemeProvider>
  );
}
