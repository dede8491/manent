import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useStyles } from '@/src/themeCtx';

function CaptureTabButton() {
  const router = useRouter();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      testID="tab-capture"
      onPress={() => router.push('/capture?mode=camera' as any)}
      hitSlop={{ top: 20, bottom: 8, left: 12, right: 12 }}
      style={styles.captureBtn}
    >
      <View style={styles.captureInner}>
        <Feather name="camera" size={22} color="#F5EDE4" />
      </View>
    </Pressable>
  );
}

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
      <Tabs.Screen name="capture-tab" options={{
        tabBarButton: () => <CaptureTabButton />,
      }} />
      <Tabs.Screen name="community" options={{ tabBarIcon: ({ color }) => <Feather name="bookmark" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  captureBtn: {
    flex: 1,
    minWidth: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.chambray,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.creme,
    transform: [{ translateY: -12 }],
  },
});
