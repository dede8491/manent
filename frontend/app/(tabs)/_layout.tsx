import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

// Barre : Accueil (journal du jour), Journal, Bibliothèque, Découvrir, Profil.
// Les citations vivent dans Journal (segment). Communauté reste un écran masqué de la barre (Découvrir, Profil).
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const t = useT();
  const tabBarHeight = 60;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.chambray,
        tabBarInactiveTintColor: colors.clay,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.creme,
          borderTopColor: colors.borderSoft,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'web' ? { height: tabBarHeight + insets.bottom } : {}),
        },
        tabBarItemStyle: { alignSelf: 'center' },
        sceneStyle: { backgroundColor: colors.glacier },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('Accueil'), tabBarAccessibilityLabel: t('Accueil'), tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }} />
      <Tabs.Screen name="journal" options={{ title: t('Journal'), tabBarAccessibilityLabel: t('Journal'), tabBarIcon: ({ color }) => <Feather name="edit-3" size={22} color={color} /> }} />
      <Tabs.Screen name="library" options={{ title: t('Bibliothèque'), tabBarAccessibilityLabel: t('Bibliothèque'), tabBarIcon: ({ color }) => <Feather name="book" size={22} color={color} /> }} />
      <Tabs.Screen name="discover" options={{ title: t('Découvrir'), tabBarAccessibilityLabel: t('Découvrir'), tabBarIcon: ({ color }) => <Feather name="compass" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('Profil'), tabBarAccessibilityLabel: t('Profil'), tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
      <Tabs.Screen name="quotes" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
    </Tabs>
  );
}
