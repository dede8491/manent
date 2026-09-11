import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT, useLang } from '@/src/i18n';
import { Entry, dayLabel, moodOf } from '@/src/journal';
import { MoodTimeline, MoodPoint } from '@/src/components/MoodTimeline';

// Fiche livre — section Journal : frise des humeurs, dernières entrées, écrire, fiche de fin de livre.
export function JournalBookSection({ bookId, status, refreshKey }: { bookId: string; status?: string; refreshKey?: string }) {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [data, setData] = useState<{ moods: MoodPoint[]; entries: Entry[] } | null>(null);

  useEffect(() => {
    api<any>(`/journal/books/${bookId}`).then(r => setData({ moods: r.moods || [], entries: r.entries || [] })).catch(() => setData({ moods: [], entries: [] }));
  }, [bookId, refreshKey]);

  const entries = data?.entries || [];
  const moods = data?.moods || [];
  const finished = status === 'termine';

  return (
    <View testID="book-journal">
      <Text style={styles.sectionLabel}>{t('Mon journal')}</Text>
      <View style={styles.box}>
        {moods.length >= 2 && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.subLabel}>{t('Humeur au fil des sessions')}</Text>
            <MoodTimeline points={moods} height={84} />
          </View>
        )}
        {entries.length === 0 ? (
          <Text style={styles.empty}>{t('Aucune entrée pour ce livre. Note ta prochaine session : page, humeur, une phrase.')}</Text>
        ) : entries.slice(0, 3).map(e => {
          const mood = moodOf(e.mood);
          return (
            <Pressable key={e.entry_id} testID={`book-journal-entry-${e.entry_id}`} onPress={() => router.push({ pathname: '/journal/[id]', params: { id: e.entry_id } })} style={styles.entry}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                {mood && <View style={[styles.dot, { backgroundColor: mood.color }]} />}
                <Text style={styles.entryMeta}>{dayLabel(e.date, lang)}{mood ? ` · ${t(mood.label)}` : ''}{e.page ? ` · p. ${e.page}` : ''}</Text>
              </View>
              <Text style={styles.entryText} numberOfLines={2}>{e.content || (e.quotes?.[0] ? `« ${e.quotes[0].text} »` : t('Une humeur notée, sans mots.'))}</Text>
            </Pressable>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md, flexWrap: 'wrap' }}>
          <Pressable testID="book-journal-write" onPress={() => router.push({ pathname: '/journal/new', params: { book_id: bookId } })} style={styles.primary}>
            <Feather name="feather" size={14} color={colors.creme} /><Text style={styles.primaryText}>{t('Écrire une entrée')}</Text>
          </Pressable>
          {entries.length > 3 && (
            <Pressable testID="book-journal-all" onPress={() => router.push({ pathname: '/(tabs)/journal', params: { book_id: bookId } })} style={styles.ghost}>
              <Text style={styles.ghostText}>{t('Toutes ({n})', { n: entries.length })}</Text>
            </Pressable>
          )}
        </View>
        {(finished || entries.length > 0) && (
          <Pressable testID="book-wrapup" onPress={() => router.push({ pathname: '/journal/wrapup/[bookId]', params: { bookId } })} style={styles.wrapup}>
            <Feather name="award" size={16} color={colors.chambray} />
            <View style={{ flex: 1 }}>
              <Text style={styles.wrapupTitle}>{finished ? t('Fiche de fin de livre') : t('Aperçu de la fiche de fin')}</Text>
              <Text style={styles.wrapupSub}>{t('Tes humeurs, tes citations, ta note : à garder ou à partager en image.')}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.clay} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  box: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  subLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, lineHeight: 19 },
  entry: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  dot: { width: 8, height: 8, borderRadius: 4 },
  entryMeta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, textTransform: 'capitalize' },
  entryText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 19 },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.chambray },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  ghost: { height: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  wrapup: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  wrapupTitle: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.espresso },
  wrapupSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 1 },
});
