import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/src/themeCtx';

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
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ color, focused }) => (
        <Feather name={focused ? 'grid' : 'grid'} size={22} color={color} />) }} />
      <Tabs.Screen name="library" options={{ tabBarIcon: ({ color }) => <Feather name="book" size={22} color={color} /> }} />
      <Tabs.Screen name="quotes" options={{ tabBarIcon: ({ color }) => <Feather name="feather" size={22} color={color} /> }} />
      <Tabs.Screen name="community" options={{ tabBarIcon: ({ color }) => <Feather name="bookmark" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}

