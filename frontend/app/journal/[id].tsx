import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT, useLang } from '@/src/i18n';
import { BookCover } from '@/src/components/BookCover';
import { BottomSheet } from '@/src/components/BottomSheet';
import { Toast } from '@/src/components/Toast';
import ManentLoader from '@/src/components/ManentLoader';
import { Entry, dayLabel, moodOf } from '@/src/journal';

// Détail d'une entrée de journal : livre, date, humeur, prompt, texte, citations ; modifier, publier, supprimer.
export default function JournalEntry() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(saved ? 'Entrée enregistrée.' : null);

  useFocusEffect(useCallback(() => {
    api<Entry>(`/journal/entries/${id}`).then(setEntry).catch(() => setMissing(true));
  }, [id]));

  const togglePublic = async () => {
    if (!entry) return;
    try { setEntry(await api<Entry>(`/journal/entries/${id}`, { method: 'PATCH', body: JSON.stringify({ is_public: !entry.is_public }) })); } catch {}
  };
  const remove = async () => {
    setConfirm(false);
    try { await api(`/journal/entries/${id}`, { method: 'DELETE' }); router.back(); } catch { setToast(t('Suppression impossible.')); }
  };
  const share = async () => {
    if (!entry) return;
    const head = entry.book?.title ? `${entry.book.title}${entry.page ? `, p. ${entry.page}` : ''}` : '';
    const body = entry.content || (entry.quotes?.[0] ? `« ${entry.quotes[0].text} »` : '');
    try { await Share.share({ message: [head, body, '— Manent, journal de lecture'].filter(Boolean).join('\n\n') }); } catch {}
  };
  const mood = moodOf(entry?.mood);

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-journal-entry">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="journal-entry-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Journal')}</Text>
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={share} testID="journal-entry-share" style={styles.iconBtn}><Feather name="share" size={18} color={colors.espresso} /></Pressable>
          <Pressable onPress={() => router.push({ pathname: '/journal/new', params: { entry_id: id } })} testID="journal-entry-edit" style={styles.iconBtn}><Feather name="edit-2" size={18} color={colors.espresso} /></Pressable>
          <Pressable onPress={() => setConfirm(true)} testID="journal-entry-delete" style={styles.iconBtn}><Feather name="trash-2" size={18} color={colors.espresso} /></Pressable>
        </View>
      </View>

      {missing ? (
        <Text style={styles.missing}>{t('Cette entrée n’existe plus.')}</Text>
      ) : !entry ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader size={56} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          {!!entry.book?.book_id && (
            <Pressable testID="journal-entry-book" onPress={() => router.push({ pathname: '/book/[id]', params: { id: entry.book!.book_id! } })} style={styles.bookRow}>
              <BookCover uri={entry.book.cover || undefined} title={entry.book.title || ''} width={40} height={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bookTitle} numberOfLines={2}>{entry.book.title}</Text>
                {!!entry.book.author && <Text style={styles.bookAuthor} numberOfLines={1}>{entry.book.author}</Text>}
              </View>
              <Feather name="chevron-right" size={16} color={colors.clay} />
            </Pressable>
          )}
          <View style={styles.metaRow}>
            {mood && <View style={[styles.moodPill, { backgroundColor: mood.color }]}><Text style={[styles.moodText, { color: mood.value >= 4 || mood.value === 1 ? '#FFFFFF' : colors.espresso }]}>{t(mood.label)}</Text></View>}
            <Text style={styles.meta}>{dayLabel(entry.date, lang)}{entry.page ? ` · ${t('page')} ${entry.page}` : entry.chapter ? ` · ${t('chapitre')} ${entry.chapter}` : ''}</Text>
          </View>
          {!!entry.prompt_text && <Text style={styles.prompt}>{entry.prompt_text}</Text>}
          {!!entry.content && <Text style={styles.content}>{entry.content}</Text>}
          {(entry.quotes || []).map(q => (
            <Pressable key={q.quote_id} testID={`journal-entry-quote-${q.quote_id}`} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: q.quote_id } })} style={styles.quote}>
              <Text style={styles.quoteText}>« {q.text} »</Text>
              {!!q.page && <Text style={styles.quotePage}>p. {q.page}</Text>}
            </Pressable>
          ))}
          <Pressable testID="journal-entry-public" onPress={togglePublic} style={styles.visRow}>
            <Feather name={entry.is_public ? 'globe' : 'lock'} size={14} color={entry.is_public ? colors.chambray : colors.clay} />
            <Text style={styles.visText}>{entry.is_public ? t('Publiée sur ton profil · rendre privée') : t('Privée · publier sur mon profil')}</Text>
          </Pressable>
        </ScrollView>
      )}

      <BottomSheet visible={confirm} onClose={() => setConfirm(false)} title={t('Supprimer cette entrée ?')} testID="journal-entry-confirm" scroll={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable testID="journal-entry-cancel" onPress={() => setConfirm(false)} style={styles.ghostBtn}><Text style={styles.ghostText}>{t('Annuler')}</Text></Pressable>
          <Pressable testID="journal-entry-confirm-go" onPress={remove} style={styles.dangerBtn}><Text style={styles.dangerText}>{t('Supprimer')}</Text></Pressable>
        </View>
      </BottomSheet>
      <Toast visible={!!toast} text={toast ? t(toast) : ''} onHide={() => setToast(null)} />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  missing: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.xxl },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.lg },
  bookTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  bookAuthor: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  moodPill: { height: 26, paddingHorizontal: 10, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  moodText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.clay, textTransform: 'capitalize' },
  prompt: { fontFamily: fonts.display, fontSize: 18, color: colors.chambray, lineHeight: 24, marginBottom: spacing.sm },
  content: { fontFamily: fonts.body, fontSize: 16, color: colors.espresso, lineHeight: 26 },
  quote: { marginTop: spacing.lg, paddingLeft: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.chambray },
  quoteText: { fontFamily: fonts.display, fontSize: 18, color: colors.espresso, lineHeight: 25 },
  quotePage: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 4 },
  visRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  visText: { fontFamily: fonts.body, fontSize: 13, color: colors.clay },
  ghostBtn: { flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso },
  dangerBtn: { flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
});
