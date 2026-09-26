import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { SchoolProvider, useSchool } from '@/lib/school-store';

SplashScreen.preventAutoHideAsync();

function HideSplashWhenReady() {
  const { loaded } = useSchool();
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
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
        <HideSplashWhenReady />
        <AppTabs />
      </SchoolProvider>
    </ThemeProvider>
  );
}
