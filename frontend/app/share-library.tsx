import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { fonts, radius, spacing, colors as brand } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { shareUrl } from '@/src/share';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

type Book = { book_id: string; title: string; cover?: string | null; type?: string };
type Format = 'story' | 'carre';

// Partager ma bibliothèque : un lien public, ou une image prête pour les réseaux
// (story 1080 × 1920, carré 1080 × 1080) — mosaïque de douze couvertures, charte Manent.
export default function ShareLibrary() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<Format>('story');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const cardRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ books: Book[] }>('/books');
        setBooks((r.books || []).filter(b => b.type !== 'etude'));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const url = user?.handle ? shareUrl.library(user.handle) : '';
  const covers = books.slice(0, 12);

  const shareLink = async () => {
    const message = t('Ma bibliothèque sur Manent — {url}', { url });
    try {
      if (Platform.OS === 'web') {
        const nav: any = navigator;
        if (nav.share) await nav.share({ title: 'Manent', text: message });
        else if (nav.clipboard) { await nav.clipboard.writeText(message); setFeedback(t('Lien copié dans le presse-papiers.')); }
        else setFeedback(url);
      } else {
        await Share.share({ message });
      }
    } catch { setFeedback(url); }
  };

  const shareImage = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web') { setFeedback(t('L’image se partage depuis l’application mobile.')); return; }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: format === 'story' ? 1080 : 1080, height: format === 'story' ? 1920 : 1080 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('Partager ma bibliothèque') });
      }
    } catch {
      setFeedback(t('Le partage a échoué. Réessaie.'));
    } finally { setBusy(false); }
  };

  // Carte rendue à l'écran en aperçu (échelle réduite) et capturée à taille réelle.
  const W = format === 'story' ? 1080 : 1080;
  const H = format === 'story' ? 1920 : 1080;
  const previewScale = 0.28;
  const cols = 4, rows = format === 'story' ? 3 : 3;
  const pad = 84;
  const gap = 24;
  const coverW = (W - pad * 2 - gap * (cols - 1)) / cols;
  const coverH = coverW * 1.5;

  const card = (
    <View ref={cardRef} collapsable={false} style={{ width: W, height: H, backgroundColor: brand.glacier, padding: pad, justifyContent: 'space-between' }} testID="share-library-card">
      <View>
        <Text style={{ fontFamily: fonts.displayMedium, fontSize: 64, color: brand.espresso }}>Manent</Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 22, color: brand.clay, letterSpacing: 5, textTransform: 'uppercase', marginTop: 6 }}>verba volant, scripta manent</Text>
      </View>
      <View>
        <Text style={{ fontFamily: fonts.displayMedium, fontSize: format === 'story' ? 74 : 60, color: brand.espresso, lineHeight: format === 'story' ? 84 : 68 }}>
          {t('La bibliothèque de {name}', { name: user?.pseudo || '' })}
        </Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 24, color: brand.clay, letterSpacing: 3, textTransform: 'uppercase', marginTop: 12, marginBottom: 40 }}>
          {t(books.length > 1 ? '{n} livres' : '{n} livre', { n: books.length })}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {Array.from({ length: cols * rows }).map((_, i) => {
            const b = covers[i];
            return b ? (
              <BookCover key={b.book_id} uri={b.cover} title={b.title} width={coverW} height={coverH} radius={14} initialSize={64} />
            ) : (
              <View key={`ph-${i}`} style={{ width: coverW, height: coverH, borderRadius: 14, backgroundColor: brand.bisque, opacity: 0.5 }} />
            );
          })}
        </View>
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 24, color: brand.clay }}>@{user?.handle}  ·  manentlc.app</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-share-library">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="share-library-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Partager')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}><ManentLoader size={48} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          <Text style={styles.title}>{t('Partager ma bibliothèque')}</Text>
          <Text style={styles.sub}>{t('Un lien vers ta bibliothèque publique, ou une image prête pour tes réseaux.')}</Text>

          <Pressable testID="share-library-link" onPress={shareLink} style={styles.rowBtn}>
            <Feather name="link" size={18} color={colors.chambray} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('Partager le lien')}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{url}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>

          <Text style={styles.sectionLabel}>{t('Image pour les réseaux')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['story', 'Story 9:16'], ['carre', 'Carré 1:1']] as [Format, string][]).map(([f, lbl]) => (
              <Pressable key={f} testID={`share-library-format-${f}`} onPress={() => setFormat(f)} style={[styles.chip, format === f && styles.chipActive]}>
                <Text style={[styles.chipText, format === f && styles.chipTextActive]}>{t(lbl)}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.preview, { height: H * previewScale + 2 }]}>
            <View style={{ width: W * previewScale, height: H * previewScale, overflow: 'hidden', borderRadius: radius.md }}>
              <View style={{ transform: [{ scale: previewScale }], transformOrigin: 'top left' as any, width: W, height: H }}>
                {card}
              </View>
            </View>
          </View>

          <Pressable testID="share-library-image" onPress={shareImage} disabled={busy} style={({ pressed }) => [styles.primary, (pressed || busy) && { opacity: 0.85 }]}>
            {busy ? <ManentLoader size={18} variant="sombre" /> : <Feather name="share" size={16} color={colors.creme} />}
            <Text style={styles.primaryText}>{t('Partager l’image')}</Text>
          </Pressable>
          {!!feedback && <Text style={styles.feedback} testID="share-library-feedback">{feedback}</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, lineHeight: 19, marginTop: 4, marginBottom: spacing.lg },
  rowBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  rowTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  rowSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 1 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  chip: { flex: 1, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  preview: { alignItems: 'center', marginTop: spacing.md, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, padding: 1, overflow: 'hidden' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.pill, backgroundColor: colors.chambray, marginTop: spacing.lg },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.creme },
  feedback: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
