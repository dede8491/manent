import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { Toast } from '@/src/components/Toast';
import ManentLoader from '@/src/components/ManentLoader';
import { timeAgo } from '@/src/timeago';
import { useT, useLang } from '@/src/i18n';

type Reco = {
  reco_id: string; status: 'pending' | 'accepted' | 'ignored'; message?: string | null; created_at: string;
  book?: { catalog_id: string; title: string; author?: string; cover?: string | null; summary?: string | null } | null;
  from?: { pseudo: string; handle: string; picture?: string | null } | null;
};

// Recommandations reçues : couverture, titre, « de @handle », le mot, deux boutons.
export default function Recommendations() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [recos, setRecos] = useState<Reco[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; bookId?: string } | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      try { const r = await api<{ recommendations: Reco[] }>('/recommendations'); setRecos(r.recommendations || []); } catch {}
      setLoading(false);
    })();
  }, []));

  const decide = async (r: Reco, accept: boolean) => {
    try {
      const res = await api<{ book_id?: string }>(`/recommendations/${r.reco_id}/decide`, { method: 'POST', body: JSON.stringify({ accept }) });
      setRecos(prev => prev.map(x => x.reco_id === r.reco_id ? { ...x, status: accept ? 'accepted' : 'ignored' } : x));
      if (accept) setToast({ text: t('Ajouté à ta liste de lecture'), bookId: res.book_id });
    } catch {}
  };

  const pending = recos.filter(r => r.status === 'pending');
  const past = recos.filter(r => r.status !== 'pending');

  const card = (r: Reco) => (
    <View key={r.reco_id} style={styles.card} testID={`reco-${r.reco_id}`}>
      <Pressable onPress={() => r.book && router.push({ pathname: '/discover/book', params: { title: r.book.title, author: r.book.author || '', cover: r.book.cover || '', summary: r.book.summary || '', catalog_id: r.book.catalog_id } })} style={{ flexDirection: 'row', gap: spacing.md }}>
        <BookCover uri={r.book?.cover} title={r.book?.title || ''} width={56} height={82} radius={6} initialSize={22} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.avatar}>{r.from?.picture ? <Image source={{ uri: r.from.picture }} style={{ width: 22, height: 22, borderRadius: 11 }} /> : <Text style={styles.avatarText}>{(r.from?.pseudo?.[0] || 'M').toUpperCase()}</Text>}</View>
            <Text style={styles.from} numberOfLines={1}>{t('de @{handle}', { handle: r.from?.handle || '' })}  ·  {timeAgo(r.created_at, lang)}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{r.book?.title || t('Livre indisponible')}</Text>
          {!!r.book?.author && <Text style={styles.author} numberOfLines={1}>{r.book.author}</Text>}
          {!!r.message && <Text style={styles.message}>« {r.message} »</Text>}
        </View>
      </Pressable>
      {r.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          <Pressable testID={`reco-accept-${r.reco_id}`} onPress={() => decide(r, true)} style={styles.accept}>
            <Feather name="bookmark" size={14} color={colors.creme} /><Text style={styles.acceptText}>{t('Ajouter à lire')}</Text>
          </Pressable>
          <Pressable testID={`reco-ignore-${r.reco_id}`} onPress={() => decide(r, false)} style={styles.ignore}>
            <Text style={styles.ignoreText}>{t('Ignorer')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.status}>{r.status === 'accepted' ? t('AJOUTÉ À TA LISTE') : t('IGNORÉ')}</Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-recommendations">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="reco-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Recommandations')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}><ManentLoader size={48} /></View>
      ) : recos.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={styles.emptyTitle}>{t('Aucune recommandation pour l’instant.')}</Text>
          <Text style={styles.emptySub}>{t('Quand une lectrice te recommande un livre, il apparaît ici.')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.sm }}>
          <Text style={styles.h1}>{t('On t’a recommandé')}</Text>
          {pending.length === 0 && <Text style={styles.emptySub}>{t('Rien de nouveau. Tes réponses passées sont ci-dessous.')}</Text>}
          {pending.map(card)}
          {past.length > 0 && <Text style={styles.sectionLabel}>{t('Déjà traitées')}</Text>}
          {past.map(card)}
        </ScrollView>
      )}
      <Toast visible={!!toast} text={toast?.text || ''} actionLabel={toast?.bookId ? t('Voir') : undefined} onAction={() => { const id = toast?.bookId; setToast(null); if (id) router.push({ pathname: '/book/[id]', params: { id } }); }} onHide={() => setToast(null)} testID="toast-reco" />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso, marginBottom: spacing.sm },
  card: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.displayMedium, fontSize: 11, color: colors.espresso },
  from: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 0.5, flexShrink: 1 },
  title: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso, marginTop: 4, lineHeight: 22 },
  author: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 1 },
  message: { fontFamily: fonts.display, fontSize: 14.5, color: colors.espresso, marginTop: 6, lineHeight: 20 },
  accept: { flex: 1, height: 40, borderRadius: radius.pill, backgroundColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  acceptText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  ignore: { height: 40, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ignoreText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  status: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1.5, marginTop: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.lg },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
