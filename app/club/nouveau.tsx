import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, ScreenHeader, Text } from '@/components';
import { searchBooks, type BookMetadata } from '@/services/googleBooks';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';
import type { ClubType } from '@/types';

const TYPES: { value: ClubType; icon: string; label: string; hint: string }[] = [
  {
    value: 'invitation',
    icon: '🔒',
    label: 'Sur invitation',
    hint: 'Tu valides chaque demande. Idéal pour un groupe de classe.',
  },
  {
    value: 'ouvert',
    icon: '🌍',
    label: 'Ouvert à tous',
    hint: 'Le club apparaît dans la découverte, on rejoint en un tap.',
  },
];

export default function NouveauClub() {
  const router = useRouter();
  const createClub = useStore((s) => s.createClub);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ClubType>('invitation');
  const [bookTerm, setBookTerm] = useState('');
  const [results, setResults] = useState<BookMetadata[]>([]);
  const [picked, setPicked] = useState<BookMetadata | null>(null);
  const [deadline, setDeadline] = useState('');
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (bookTerm.trim().length < 2) return;
    setSearching(true);
    try {
      setResults(await searchBooks(bookTerm));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const create = () => {
    const club = createClub({
      name,
      description,
      type,
      bookTitle: picked?.title ?? '',
      bookAuthor: picked?.author ?? '',
      deadline: deadline.trim() || new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    router.replace(`/club/${club.id}`);
  };

  return (
    <Screen>
      <ScreenHeader title="Créer mon club de lecture" />

      <Field label="Nom du club" value={name} onChangeText={setName} placeholder="Le Cercle de l'encre verte" />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Un livre par mois, une visio le dimanche, zéro pression."
      />

      <Text variant="overline" style={styles.label}>
        TYPE
      </Text>
      {TYPES.map((t) => (
        <Card key={t.value} onPress={() => setType(t.value)} style={[styles.option, type === t.value && styles.optionOn]}>
          <View style={styles.optionRow}>
            <Text style={styles.icon}>{t.icon}</Text>
            <View style={styles.optionText}>
              <Text variant="label">{t.label}</Text>
              <Text variant="small">{t.hint}</Text>
            </View>
            <Text color={type === t.value ? colors.green : colors.rule} style={styles.check}>
              {type === t.value ? '●' : '○'}
            </Text>
          </View>
        </Card>
      ))}

      <Text variant="overline" style={styles.label}>
        PREMIÈRE LECTURE COMMUNE
      </Text>
      <Field
        value={bookTerm}
        onChangeText={setBookTerm}
        onSubmitEditing={search}
        placeholder="Chercher un livre…"
        returnKeyType="search"
      />
      <Button label="Rechercher" variant="secondary" onPress={search} loading={searching} />

      {picked ? (
        <Card style={styles.picked}>
          <Text variant="overline">LECTURE CHOISIE</Text>
          <Text variant="sectionTitle">{picked.title}</Text>
          <Text variant="small">{picked.author}</Text>
          <Button label="Changer" variant="ghost" onPress={() => setPicked(null)} />
        </Card>
      ) : (
        <View style={styles.results}>
          {results.slice(0, 5).map((r, i) => (
            <Card key={`${r.title}-${i}`} onPress={() => setPicked(r)}>
              <Text variant="label">{r.title}</Text>
              <Text variant="small">{r.author}</Text>
            </Card>
          ))}
        </View>
      )}

      <Field
        label="Échéance"
        value={deadline}
        onChangeText={setDeadline}
        placeholder="2026-09-30"
        hint="Format AAAA-MM-JJ. Par défaut, dans un mois."
      />

      <Button label="Créer le club" disabled={name.trim().length < 2} onPress={create} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: spacing.md, marginBottom: spacing.sm },
  option: { paddingVertical: spacing.md },
  optionOn: { borderColor: colors.green, backgroundColor: colors.greenPale },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 22, marginRight: spacing.md },
  optionText: { flex: 1 },
  check: { fontSize: 18 },
  results: { marginTop: spacing.md },
  picked: { marginTop: spacing.md, borderColor: colors.green },
  cta: { marginTop: spacing.lg },
});
