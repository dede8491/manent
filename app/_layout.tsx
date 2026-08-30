import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import { colors, useAppFonts } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* le splash peut déjà être masqué en rechargement à chaud */
});

export default function RootLayout() {
  const fontsReady = useAppFonts();
  const hydrated = useStore((s) => s.hydrated);
  const ready = fontsReady && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="capture" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="ajouter" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="partager" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
