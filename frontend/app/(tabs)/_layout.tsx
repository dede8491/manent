import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/src/themeCtx';

// Barre : Accueil (journal du jour), Journal, Bibliothèque, Découvrir, Profil.
// Citations et Communauté restent des écrans de l'app (accessibles depuis Découvrir) sans bouton dans la barre.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
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
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }} />
      <Tabs.Screen name="journal" options={{ tabBarIcon: ({ color }) => <Feather name="edit-3" size={22} color={color} /> }} />
      <Tabs.Screen name="library" options={{ tabBarIcon: ({ color }) => <Feather name="book" size={22} color={color} /> }} />
      <Tabs.Screen name="discover" options={{ tabBarIcon: ({ color }) => <Feather name="compass" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
      <Tabs.Screen name="quotes" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
    </Tabs>
  );
}
