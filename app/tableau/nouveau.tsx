import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, ScreenHeader, Text } from '@/components';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';
import type { BoardVisibility } from '@/types';

const OPTIONS: { value: BoardVisibility; icon: string; label: string; hint: string }[] = [
  { value: 'prive', icon: '🔒', label: 'Privé', hint: 'Toi seule y as accès.' },
  {
    value: 'public',
    icon: '🌍',
    label: 'Public',
    hint: 'Affiché sur ton profil et proposé dans la découverte.',
  },
  {
    value: 'collaboratif',
    icon: '👥',
    label: 'Collaboratif',
    hint: 'Les personnes invitées peuvent épingler aussi.',
  },
];

export default function NouveauTableau() {
  const router = useRouter();
  const addBoard = useStore((s) => s.addBoard);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<BoardVisibility>('prive');

  const create = () => {
    const board = addBoard(name, description, visibility);
    router.replace(`/tableau/${board.id}`);
  };

  return (
    <Screen>
      <ScreenHeader title="Nouveau tableau" />

      <Field
        label="Nom"
        value={name}
        onChangeText={setName}
        placeholder="Pour les matins durs"
        maxLength={60}
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="À quoi sert ce tableau ?"
      />

      <Text variant="overline" style={styles.label}>
        VISIBILITÉ
      </Text>
      {OPTIONS.map((opt) => (
        <Card
          key={opt.value}
          onPress={() => setVisibility(opt.value)}
          style={[styles.option, visibility === opt.value && styles.optionOn]}
        >
          <View style={styles.optionRow}>
            <Text style={styles.icon}>{opt.icon}</Text>
            <View style={styles.optionText}>
              <Text variant="label">{opt.label}</Text>
              <Text variant="small">{opt.hint}</Text>
            </View>
            <Text color={visibility === opt.value ? colors.green : colors.rule} style={styles.check}>
              {visibility === opt.value ? '●' : '○'}
            </Text>
          </View>
        </Card>
      ))}

      <Button
        label="Créer le tableau"
        disabled={name.trim().length < 2}
        onPress={create}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm },
  option: { paddingVertical: spacing.md },
  optionOn: { borderColor: colors.green, backgroundColor: colors.greenPale },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 22, marginRight: spacing.md },
  optionText: { flex: 1 },
  check: { fontSize: 18 },
  cta: { marginTop: spacing.lg },
});
