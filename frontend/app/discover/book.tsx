import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { PrimaryButton } from '@/src/components/Button';
import { useT } from '@/src/i18n';

export default function DiscoverBook() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { title, author, cover, year, summary, prize } = useLocalSearchParams<any>();
  const [status, setStatus] = useState<'a_lire' | 'en_cours' | 'termine'>('a_lire');
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    try {
      const b = await api<{ book_id: string }>('/books', {
        method: 'POST',
        body: JSON.stringify({ type: 'papier', title, author: author || undefined, cover: cover || undefined, year: year || undefined, status }),
      });
      router.replace({ pathname: '/book/[id]', params: { id: b.book_id } });
    } finally { setAdding(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-discover-book">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="discover-book-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Découverte')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl, alignItems: 'center' }}>
        <BookCover uri={cover} title={title || ''} width={140} height={210} radius={10} initialSize={48} />
        {prize ? <View style={styles.prizeTag}><Text style={styles.prizeText}>{prize}</Text></View> : null}
        <Text style={styles.title}>{title}</Text>
        {!!author && <Text style={styles.author}>{author}{year ? `  ·  ${year}` : ''}</Text>}
        {!!summary && <Text style={styles.summary}>{summary}</Text>}

        <View style={styles.statusRow}>
          {([['a_lire', 'À lire'], ['en_cours', 'En cours'], ['termine', 'Déjà lu']] as const).map(([sid, lbl]) => (
            <Pressable key={sid} testID={`discover-status-${sid}`} onPress={() => setStatus(sid)} style={[styles.chip, status === sid && styles.chipActive]}>
              <Text style={[styles.chipText, status === sid && styles.chipTextActive]}>{t(lbl)}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton testID="discover-add" title={t('Ajouter à ma bibliothèque')} onPress={add} loading={adding} style={{ alignSelf: 'stretch' }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  prizeTag: { backgroundColor: colors.chambray, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.md },
  prizeText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.creme, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso, textAlign: 'center', marginTop: spacing.md },
  author: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: 4 },
  summary: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 20, marginTop: spacing.md },
  statusRow: { flexDirection: 'row', gap: 8, marginVertical: spacing.lg, alignSelf: 'stretch' },
  chip: { flex: 1, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
});
