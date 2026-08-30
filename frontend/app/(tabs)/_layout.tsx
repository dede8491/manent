import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme';

function CaptureTabButton() {
  const router = useRouter();
  return (
    <Pressable
      testID="tab-capture"
      onPress={() => router.push('/capture')}
      style={styles.captureBtn}
    >
      <View style={styles.captureInner}>
        <Feather name="camera" size={22} color={colors.creme} />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
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
      <Tabs.Screen name="capture" options={{
        tabBarButton: () => <CaptureTabButton />,
      }} />
      <Tabs.Screen name="community" options={{ tabBarIcon: ({ color }) => <Feather name="bookmark" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  captureBtn: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },
  captureInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.chambray,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.creme,
  },
});
