import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { PrimaryButton } from '@/src/components/Button';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';

const MODES = [
  { id: 'plaisir', label: 'Plaisir', desc: 'Je lis pour respirer.' },
  { id: 'etudes', label: 'Études', desc: 'Je prépare des examens.' },
  { id: 'both', label: 'Les deux', desc: 'Je jongle entre les deux.' },
] as const;

export default function Themes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updateUser } = useAuth();
  const [mode, setMode] = useState<'plaisir'|'etudes'|'both'|null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ themes: string[] }>('/themes').then(r => setThemes(r.themes));
  }, []);

  const toggle = (t: string) => {
    setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const save = async () => {
    if (!mode || selected.length < 3) return;
    setLoading(true);
    try {
      await updateUser({ reading_mode: mode, themes: selected });
      // Seed demo data so home feed isn't empty
      try { await api('/dev/seed', { method: 'POST' }); } catch {}
      router.replace('/(tabs)/home');
    } finally { setLoading(false); }
  };

  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]} testID="onboarding-themes">
      <ScrollView contentContainerStyle={{ padding: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Text style={styles.step}>Étape 2 sur 2</Text>
        <Text style={styles.title}>Tu lis surtout pour…</Text>
        <View style={styles.modeRow}>
          {MODES.map(m => (
            <Pressable
              key={m.id}
              testID={`mode-${m.id}`}
              onPress={() => setMode(m.id)}
              style={[styles.modeCard, mode === m.id && styles.modeCardActive]}
            >
              <Text style={[styles.modeLabel, mode === m.id && { color: colors.creme }]}>{m.label}</Text>
              <Text style={[styles.modeDesc, mode === m.id && { color: colors.creme, opacity: 0.9 }]}>{m.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.title, { marginTop: spacing.xxl }]}>Choisis tes thèmes</Text>
        <Text style={styles.sub}>Au moins 3, pour construire ton fil.</Text>
        <View style={styles.tagWrap}>
          {themes.map(t => {
            const active = selected.includes(t);
            return (
              <Pressable key={t} testID={`theme-${t}`} onPress={() => toggle(t)} style={[styles.tag, active && styles.tagActive]}>
                <Text style={[styles.tagText, active && { color: colors.creme }]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
        <PrimaryButton
          testID="btn-themes-continue"
          title={selected.length < 3 ? `${selected.length}/3 thèmes` : 'Continuer'}
          disabled={!mode || selected.length < 3}
          loading={loading}
          onPress={save}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.glacier },
  step: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso, marginTop: spacing.sm },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: 4 },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modeCard: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, minHeight: 90 },
  modeCardActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  modeLabel: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  modeDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: spacing.xs },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.lg },
  tag: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  tagActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  tagText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
});
