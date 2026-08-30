import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { AuthProvider, useAuth } from '@/src/auth';
import { ThemeProvider, useColors, useScheme } from '@/src/themeCtx';
import { I18nProvider } from '@/src/i18n';
import { initializeRevenueCat, SubscriptionProvider } from '@/src/revenuecat';

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

try {
  initializeRevenueCat();
} catch (err) {
  console.warn('RevenueCat unavailable:', err);
}

const queryClient = new QueryClient();

function NavGate() {
  const { user, loading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (loading) return;
    const first = segments[0];
    const atRoot = !first;
    const inOnboarding = first === 'onboarding';
    const inAuth = first === '(auth)';
    if (!user) {
      if (atRoot) router.replace('/onboarding');
      else if (!inOnboarding && !inAuth) router.replace('/onboarding');
    } else {
      if (atRoot || inOnboarding || inAuth) {
        if (!user.reading_mode) router.replace('/onboarding/themes');
        else router.replace('/(tabs)/home');
      }
    }
  }, [user, loading, segments]);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.glacier } }} />;
}

function ThemedApp() {
  const colors = useColors();
  const scheme = useScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.glacier }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <NavGate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    'CormorantGaramond-Italic': require('../assets/fonts/CormorantGaramond-Italic.ttf'),
    'CormorantGaramond-MediumItalic': require('../assets/fonts/CormorantGaramond-MediumItalic.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <SubscriptionProvider>
            <ThemedApp />
          </SubscriptionProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
