import { Tabs, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components';
import { colors, fonts, shadow } from '@/theme';

/** Bouton central surélevé : il n'ouvre pas d'onglet mais la modale de capture. */
function CaptureButton() {
  const router = useRouter();
  return (
    <View style={styles.captureSlot} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Capturer une citation"
        onPress={() => router.push('/capture')}
        style={({ pressed }) => [styles.capture, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Text style={styles.captureIcon}>＋</Text>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.rule,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="bibliotheque"
        options={{
          title: 'Bibliothèque',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>📚</Text>,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: '',
          tabBarButton: () => <CaptureButton />,
        }}
      />
      <Tabs.Screen
        name="communaute"
        options={{
          title: 'Communauté',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>🌿</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20 },
  captureSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  capture: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Platform.OS === 'ios' ? -22 : -20,
    borderWidth: 4,
    borderColor: colors.card,
    ...shadow.floating,
  },
  captureIcon: { fontSize: 28, color: colors.white, lineHeight: 32 },
});
