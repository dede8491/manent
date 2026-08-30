import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Screen, ScreenHeader, Text } from '@/components';
import { ONBOARDING_THEMES } from '@/data/themes';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';
import type { ReadingMode } from '@/types';

const MODES: { value: ReadingMode; emoji: string; label: string; hint: string }[] = [
  { value: 'plaisir', emoji: '🌿', label: 'Plaisir', hint: 'Fil, tableaux et clubs de lecture en avant.' },
  { value: 'etudes', emoji: '🎓', label: 'Études', hint: 'Fiches de lecture, flashcards et groupes de classe.' },
  { value: 'les-deux', emoji: '✨', label: 'Les deux', hint: 'Toutes les fonctionnalités, rien de masqué.' },
];

const MIN_THEMES = 3;

export default function Personnalisation() {
  const router = useRouter();
  const setReadingMode = useStore((s) => s.setReadingMode);
  const [mode, setMode] = useState<ReadingMode>('les-deux');
  const [themes, setThemes] = useState<string[]>([]);

  const toggle = (slug: string) =>
    setThemes((prev) => (prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]));

  const enough = themes.length >= MIN_THEMES;

  const next = () => {
    setReadingMode(mode);
    // Les thèmes choisis initialisent le fil d'accueil.
    useStore.setState((s) => ({ user: { ...s.user, followedThemes: themes } }));
    router.push('/onboarding/compte');
  };

  return (
    <Screen>
      <ScreenHeader
        title="On ajuste Manent à ta lecture"
        subtitle="Deux questions, puis on te laisse tranquille."
      />

      <Text variant="sectionTitle" style={styles.question}>
        Tu lis surtout pour…
      </Text>
      {MODES.map((m) => (
        <Card key={m.value} onPress={() => setMode(m.value)} style={[styles.mode, mode === m.value && styles.modeOn]}>
          <View style={styles.modeRow}>
            <Text style={styles.modeEmoji}>{m.emoji}</Text>
            <View style={styles.modeText}>
              <Text variant="label">{m.label}</Text>
              <Text variant="small">{m.hint}</Text>
            </View>
            <Text style={styles.check} color={mode === m.value ? colors.green : colors.rule}>
              {mode === m.value ? '●' : '○'}
            </Text>
          </View>
        </Card>
      ))}

      <Text variant="sectionTitle" style={styles.question}>
        Choisis au moins {MIN_THEMES} thèmes
      </Text>
      <Text variant="bodySoft" style={styles.hint}>
        Ils remplissent ton fil dès l’ouverture. Tu pourras en suivre d’autres plus tard.
      </Text>
      <View style={styles.chips}>
        {ONBOARDING_THEMES.map((t) => (
          <Chip
            key={t.slug}
            label={`${t.emoji} #${t.slug}`}
            selected={themes.includes(t.slug)}
            onPress={() => toggle(t.slug)}
          />
        ))}
      </View>

      <Button
        label={enough ? 'Continuer' : `Encore ${MIN_THEMES - themes.length}`}
        disabled={!enough}
        onPress={next}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: { marginTop: spacing.lg, marginBottom: spacing.md },
  hint: { marginTop: -spacing.sm, marginBottom: spacing.md },
  mode: { paddingVertical: spacing.md },
  modeOn: { borderColor: colors.green, backgroundColor: colors.greenPale },
  modeRow: { flexDirection: 'row', alignItems: 'center' },
  modeEmoji: { fontSize: 24, marginRight: spacing.md },
  modeText: { flex: 1 },
  check: { fontSize: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  cta: { marginTop: spacing.lg },
});
