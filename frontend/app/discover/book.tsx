import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { PrimaryButton } from '@/src/components/Button';
import { BookHero, AreaLine } from '@/src/components/BookHero';
import { ClassificationLines } from '@/src/components/ClassificationLines';
import { ShareBookSheet } from '@/src/components/ShareBookSheet';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { ErrorState } from '@/src/components/ErrorState';
import { Toast } from '@/src/components/Toast';
import ManentLoader from '@/src/components/ManentLoader';
import { Feather } from '@expo/vector-icons';
import { useT, useI18n } from '@/src/i18n';

type Info = { title: string; author?: string; cover?: string | null; year?: string; summary?: string | null; prize?: string; catalog_id?: string; isbn?: string; pages?: number };

// Fiche catalogue unique (livre pas encore dans ma bibliothèque). Trois façons d'y arriver :
// par identifiant (`catalog_id`, liens /b/…), par code-barres (`isbn`, scanner) ou par données déjà connues (title, author…).
// Même gabarit que la fiche livre ; « Ajouter » avec le statut choisi, à lire par défaut.
export default function DiscoverBook() {
  const t = useT();
  const { lang } = useI18n();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const p = useLocalSearchParams<any>();
  const [info, setInfo] = useState<Info | null>(p.title ? { title: p.title, author: p.author, cover: p.cover, year: p.year, summary: p.summary, prize: p.prize, catalog_id: p.catalog_id } : null);
  const [meta, setMeta] = useState<any>(null);
  const [social, setSocial] = useState<{ readers: number; avg_rating: number | null; ratings_count: number; quotes: Quote[]; in_library: boolean } | null>(null);
  const [status, setStatus] = useState<'a_lire' | 'en_cours' | 'termine'>('a_lire');
  const [adding, setAdding] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(p.summary || null);
  const [expanded, setExpanded] = useState(false);
  const [shareSheet, setShareSheet] = useState(false);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState(false);

  const load = async () => {
    setError(false);
    try {
      if (p.isbn) {
        const d = await api<any>(`/discover/isbn/${encodeURIComponent(p.isbn)}`);
        setInfo({ ...d.book, isbn: d.book.isbn || String(p.isbn) });
        setSocial({ readers: d.readers, avg_rating: d.avg_rating, ratings_count: d.ratings_count, quotes: d.quotes || [], in_library: d.in_library });
        if (d.book.summary) setDesc(d.book.summary);
        if (d.book.catalog_id) api<any>(`/catalog/book/${d.book.catalog_id}`).then(setMeta).catch(() => {});
        return;
      }
      const cid = p.catalog_id || info?.catalog_id;
      if (cid) {
        const m = await api<any>(`/catalog/book/${cid}`);
        setMeta(m);
        setInfo(prev => prev || { title: m.title, author: m.author, cover: m.cover, year: m.year, summary: m.summary, catalog_id: cid });
        if (!desc && m.summary) setDesc(m.summary);
      } else if (!info) {
        setError(true);
      }
    } catch { if (!info) setError(true); }
  };
  useEffect(() => { load(); }, [p.isbn, p.catalog_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Résumé de repli : recherche en ligne si le catalogue n'en a pas
  useEffect(() => {
    if (!info?.title || desc) return;
    let alive = true;
    api<{ summary: string | null }>(`/books-summary?title=${encodeURIComponent(info.title)}&author=${encodeURIComponent(info.author || '')}&lang=${lang}`)
      .then(r => { if (alive && r.summary) setDesc(r.summary); }).catch(() => {});
    return () => { alive = false; };
  }, [info?.title, info?.author, desc, lang]);

  const add = async () => {
    if (!info || adding) return;
    setAdding(true);
    try {
      const b = await api<{ book_id: string }>('/books', {
        method: 'POST',
        body: JSON.stringify({ type: 'papier', title: info.title, author: info.author || undefined, cover: info.cover || meta?.cover || undefined, year: info.year || undefined, isbn: info.isbn || undefined, pages: info.pages || undefined, status, catalog_id: info.catalog_id || meta?.catalog_id || undefined, summary: desc || undefined }),
      });
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      if (status === 'a_lire') { setAddedId(b.book_id); setToast(true); }
      else router.replace({ pathname: '/book/[id]', params: { id: b.book_id } });
    } catch (e: any) {
      if (e?.status === 402) router.push('/premium');
    } finally { setAdding(false); }
  };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.glacier, paddingTop: insets.top }}><BookHero label={t('Découverte')} testID="discover-book-back"><View /></BookHero><ErrorState onRetry={load} title={t('Livre introuvable.')} text={t('Ce livre n’est plus dans le catalogue, ou la connexion a échoué.')} testID="discover-error" /></View>;
  if (!info) return <View style={{ flex: 1, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center' }}><ManentLoader size={56} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-discover-book">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <BookHero
          label={t('Découverte')}
          testID="discover-book-back"
          right={(
            <Pressable onPress={() => setShareSheet(true)} testID="discover-share" accessibilityRole="button" accessibilityLabel={t('Partager')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="share" size={19} color={colors.espresso} />
            </Pressable>
          )}
        >
          <View style={{ alignItems: 'center' }}>
            <BookCover uri={info.cover || meta?.cover || undefined} title={info.title} width={140} height={210} radius={10} initialSize={48} />
            {info.prize ? <View style={styles.prizeTag}><Text style={styles.prizeText}>{info.prize}</Text></View> : null}
            <Text style={styles.title}>{info.title}</Text>
            {!!info.author && <Text style={styles.author}>{info.author}{info.year ? `  ·  ${info.year}` : ''}</Text>}
            <AreaLine areas={meta?.area_labels} countries={meta?.country_labels} style={{ marginTop: 6 }} />
            <ClassificationLines lines={meta?.lines} style={{ marginTop: 8, alignItems: 'center' }} testID="discover-classification" />
            {social && (social.readers > 0 || social.avg_rating) && (
              <Text style={styles.social} testID="discover-social">
                {social.readers > 0 ? t(social.readers > 1 ? '{n} lectrices sur Manent' : '{n} lectrice sur Manent', { n: social.readers }) : ''}
                {social.avg_rating ? `${social.readers > 0 ? '  ·  ' : ''}${social.avg_rating.toFixed(1)} ★` : ''}
              </Text>
            )}
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

          {social?.in_library || addedId ? (
            <Pressable testID="discover-in-library" onPress={() => addedId && router.push({ pathname: '/book/[id]', params: { id: addedId } })} accessibilityRole="button" style={styles.inLibrary}>
              <Feather name="check" size={16} color={colors.chambray} />
              <Text style={styles.inLibraryText}>{addedId ? t('Ajouté à ta liste de lecture  ›') : t('Déjà dans ta bibliothèque')}</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.statusRow} accessibilityRole="radiogroup">
                {([['a_lire', 'À lire'], ['en_cours', 'En cours'], ['termine', 'Déjà lu']] as const).map(([sid, lbl]) => (
                  <Pressable key={sid} testID={`discover-status-${sid}`} onPress={() => setStatus(sid)} accessibilityRole="radio" accessibilityState={{ selected: status === sid }} style={[styles.chip, status === sid && styles.chipActive]}>
                    <Text style={[styles.chipText, status === sid && styles.chipTextActive]}>{t(lbl)}</Text>
                  </Pressable>
                ))}
              </View>
              <PrimaryButton testID="discover-add" title={status === 'a_lire' ? t('Ajouter à ma liste de lecture') : t('Ajouter à ma bibliothèque')} onPress={add} loading={adding} style={{ alignSelf: 'stretch' }} />
            </>
          )}

          {social && social.quotes.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <Text style={styles.summaryLabel}>{t('Citations des lectrices')}</Text>
              {social.quotes.slice(0, 5).map(x => <QuoteCard key={x.quote_id} quote={x} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: x.quote_id } })} />)}
            </View>
          )}
        </View>
      </ScrollView>
      <ShareBookSheet visible={shareSheet} onClose={() => setShareSheet(false)} book={{ catalog_id: info.catalog_id || meta?.catalog_id, title: info.title, author: info.author || '', cover: info.cover || meta?.cover }} />
      <Toast visible={toast} text={t('Ajouté à ta liste de lecture')} actionLabel={t('Voir la file')} onAction={() => { setToast(false); router.push('/queue'); }} onHide={() => setToast(false)} testID="toast-reading-list" />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  prizeTag: { backgroundColor: colors.chambray, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.md },
  prizeText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.creme, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.espresso, textAlign: 'center', marginTop: spacing.md, lineHeight: 31 },
  author: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: 4 },
  social: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.chambray, marginTop: 8 },
  summaryBox: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginTop: spacing.sm },
  summaryLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  summary: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 20 },
  summaryMore: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray, marginTop: 8 },
  statusRow: { flexDirection: 'row', gap: 8, marginVertical: spacing.lg, alignSelf: 'stretch' },
  chip: { flex: 1, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  inLibrary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.chambray, backgroundColor: colors.creme, marginTop: spacing.lg },
  inLibraryText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.chambray },
});
