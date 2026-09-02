import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { PrimaryButton } from '@/src/components/Button';
import { BookHero, AreaLine } from '@/src/components/BookHero';
import { ShareBookSheet } from '@/src/components/ShareBookSheet';
import { Feather } from '@expo/vector-icons';
import { useT, useI18n } from '@/src/i18n';

// Fiche découverte : même gabarit que la fiche livre (dégradé bisque → glacier), avec
// les trois états et « Ajouter à ma bibliothèque » à la place de la progression.
export default function DiscoverBook() {
  const t = useT();
  const { lang } = useI18n();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { title, author, cover, year, summary, prize, catalog_id } = useLocalSearchParams<any>();
  const [status, setStatus] = useState<'a_lire' | 'en_cours' | 'termine'>('a_lire');
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState<string | null>(summary || null);
  const [expanded, setExpanded] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [shareSheet, setShareSheet] = useState(false);

  // Fiche catalogue (aire, pays, résumé) si le livre est connu du catalogue
  useEffect(() => {
    if (!catalog_id) return;
    (async () => {
      try {
        const m = await api<any>(`/catalog/book/${catalog_id}`);
        setMeta(m);
        if (!desc && m.summary) setDesc(m.summary);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog_id]);

  // Synopsis (4e de couverture) récupéré automatiquement si absent
  useEffect(() => {
    if (summary || !title || catalog_id) return;
    (async () => {
      try {
        const r = await api<{ summary: string | null }>(`/books-summary?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author || '')}&lang=${lang}`);
        if (r.summary) setDesc(r.summary);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    setAdding(true);
    try {
      const b = await api<{ book_id: string }>('/books', {
        method: 'POST',
        body: JSON.stringify({ type: 'papier', title, author: author || undefined, cover: cover || meta?.cover || undefined, year: year || undefined, status, catalog_id: catalog_id || meta?.catalog_id || undefined, summary: desc || undefined }),
      });
      router.replace({ pathname: '/book/[id]', params: { id: b.book_id } });
    } finally { setAdding(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-discover-book">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <BookHero
          label={t('Découverte')}
          testID="discover-book-back"
          right={(
            <Pressable onPress={() => setShareSheet(true)} testID="discover-share" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="share" size={19} color={colors.espresso} />
            </Pressable>
          )}
        >
          <View style={{ alignItems: 'center' }}>
            <BookCover uri={cover || meta?.cover} title={title || ''} width={140} height={210} radius={10} initialSize={48} />
            {prize ? <View style={styles.prizeTag}><Text style={styles.prizeText}>{prize}</Text></View> : null}
            <Text style={styles.title}>{title}</Text>
            {!!author && <Text style={styles.author}>{author}{year ? `  ·  ${year}` : ''}</Text>}
            <AreaLine areas={meta?.area_labels} countries={meta?.country_labels} style={{ marginTop: 6 }} />
          </View>
        </BookHero>

        <View style={{ paddingHorizontal: spacing.xl }}>
          {!!desc && (
            <View style={styles.summaryBox} testID="discover-summary">
              <Text style={styles.summaryLabel}>{t('Résumé')}</Text>
              <Text style={styles.summary} numberOfLines={expanded ? undefined : 4}>{desc}</Text>
              {desc.length > 180 && (
                <Pressable testID="discover-summary-toggle" onPress={() => setExpanded(!expanded)} hitSlop={8}>
                  <Text style={styles.summaryMore}>{expanded ? t('Réduire') : t('Lire la suite')}</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.statusRow}>
            {([['a_lire', 'À lire'], ['en_cours', 'En cours'], ['termine', 'Déjà lu']] as const).map(([sid, lbl]) => (
              <Pressable key={sid} testID={`discover-status-${sid}`} onPress={() => setStatus(sid)} style={[styles.chip, status === sid && styles.chipActive]}>
                <Text style={[styles.chipText, status === sid && styles.chipTextActive]}>{t(lbl)}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton testID="discover-add" title={t('Ajouter à ma bibliothèque')} onPress={add} loading={adding} style={{ alignSelf: 'stretch' }} />
        </View>
      </ScrollView>
      <ShareBookSheet visible={shareSheet} onClose={() => setShareSheet(false)} book={{ catalog_id: catalog_id || meta?.catalog_id, title: title || '', author: author || '' }} />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  prizeTag: { backgroundColor: colors.chambray, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.md },
  prizeText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.creme, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso, textAlign: 'center', marginTop: spacing.md, lineHeight: 31 },
  author: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: 4 },
  summaryBox: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginTop: spacing.sm },
  summaryLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  summary: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 20 },
  summaryMore: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray, marginTop: 8 },
  statusRow: { flexDirection: 'row', gap: 8, marginVertical: spacing.lg, alignSelf: 'stretch' },
  chip: { flex: 1, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
});
