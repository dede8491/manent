import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT, useLang } from '@/src/i18n';
import { timeAgo } from '@/src/timeago';
import { BookCover } from '@/src/components/BookCover';
import { Toast } from '@/src/components/Toast';
import { ErrorState } from '@/src/components/ErrorState';
import ManentLoader from '@/src/components/ManentLoader';
import { ScreenHeader } from '@/src/components/ScreenHeader';

type Reco = { reco_id: string; status: 'pending' | 'accepted' | 'ignored'; message?: string | null; created_at: string;
  book?: { catalog_id: string; title: string; author?: string; cover?: string | null; summary?: string | null } | null;
  from?: { pseudo: string; handle: string; picture?: string | null } | null };
type Inv = { invite_id: string; kind: 'board' | 'club'; status: string; target_id: string; target_name?: string; message?: string | null; created_at: string;
  from?: { pseudo: string; handle: string; picture?: string | null } | null };
type Notif = { notif_id: string; title: string; message: string; action_url?: string | null; kind?: string; read: boolean; created_at: string };
type Item = { key: string; created_at: string; status: string; kind: 'reco' | 'inv' | 'notif'; reco?: Reco; inv?: Inv; notif?: Notif };

// Centre de notifications (cloche de l'accueil) : activité (likes, commentaires, abonnements, clubs), invitations
// (tableaux, clubs) et recommandations de livres, dans un seul fil. Les anciens écrans Invitations et Recommandations redirigent ici.
export default function Inbox() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'notif' | 'reco' | 'inv'>(params.tab === 'invitations' ? 'inv' : params.tab === 'recommendations' ? 'reco' : 'all');
  const [toast, setToast] = useState<{ text: string; bookId?: string } | null>(null);

  const load = useCallback(async () => {
    const [inv, reco, notif] = await Promise.allSettled([api<{ invitations: Inv[] }>('/invitations'), api<{ recommendations: Reco[] }>('/recommendations'), api<{ notifications: Notif[] }>('/notifications')]);
    if (inv.status === 'rejected' && reco.status === 'rejected' && notif.status === 'rejected') { setError(true); setItems(prev => prev || []); return; }
    setError(false);
    const list: Item[] = [
      ...(inv.status === 'fulfilled' ? inv.value.invitations.map(i => ({ key: i.invite_id, created_at: i.created_at, status: i.status, kind: 'inv' as const, inv: i })) : []),
      ...(reco.status === 'fulfilled' ? reco.value.recommendations.map(r => ({ key: r.reco_id, created_at: r.created_at, status: r.status, kind: 'reco' as const, reco: r })) : []),
      ...(notif.status === 'fulfilled' ? notif.value.notifications.filter(n => n.kind !== 'invitation').map(n => ({ key: n.notif_id, created_at: n.created_at, status: n.read ? 'read' : 'unread', kind: 'notif' as const, notif: n })) : []),
    ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setItems(list);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decideInv = async (inv: Inv, action: 'accept' | 'decline') => {
    try {
      const r = await api<any>(`/invitations/${inv.invite_id}/${action}`, { method: 'POST' });
      setItems(prev => (prev || []).map(x => x.key === inv.invite_id ? { ...x, status: action === 'accept' ? 'accepted' : 'declined', inv: { ...inv, status: action === 'accept' ? 'accepted' : 'declined' } } : x));
      if (action === 'accept') router.push(r.kind === 'board' ? { pathname: '/board/[id]', params: { id: r.target_id } } : { pathname: '/club/[id]', params: { id: r.target_id } });
    } catch { setToast({ text: t('Action impossible. Réessaie.') }); }
  };
  const decideReco = async (r: Reco, accept: boolean) => {
    try {
      const res = await api<{ book_id?: string }>(`/recommendations/${r.reco_id}/decide`, { method: 'POST', body: JSON.stringify({ accept }) });
      const status = accept ? 'accepted' : 'ignored';
      setItems(prev => (prev || []).map(x => x.key === r.reco_id ? { ...x, status, reco: { ...r, status } } : x));
      if (accept) setToast({ text: t('Ajouté à ta liste de lecture'), bookId: res.book_id });
    } catch { setToast({ text: t('Action impossible. Réessaie.') }); }
  };

  const openTarget = (inv: Inv) => router.push(inv.kind === 'board' ? { pathname: '/board/[id]', params: { id: inv.target_id } } : { pathname: '/club/[id]', params: { id: inv.target_id } });
  const avatar = (from?: { pseudo: string; picture?: string | null } | null) => from?.picture
    ? <Image source={{ uri: from.picture }} style={styles.avatar} accessibilityIgnoresInvertColors />
    : <View style={styles.avatar}><Text style={styles.initial}>{(from?.pseudo?.[0] || 'M').toUpperCase()}</Text></View>;

  const shown = (items || []).filter(i => filter === 'all' || i.kind === filter);
  const pending = shown.filter(i => i.status === 'pending' || i.status === 'unread');
  const past = shown.filter(i => i.status !== 'pending' && i.status !== 'unread');
  const openNotif = (n: Notif) => { if (n.action_url && n.action_url.startsWith('/') && !n.action_url.startsWith('/inbox')) router.push(n.action_url as any); };
  const notifIcon = (kind?: string): React.ComponentProps<typeof Feather>['name'] => kind === 'quote_like' ? 'heart' : kind === 'quote_comment' ? 'message-circle' : kind === 'club' ? 'users' : 'bell';

  const card = (it: Item) => it.kind === 'notif' ? (
    <Pressable key={it.key} testID={`notif-${it.key}`} onPress={() => openNotif(it.notif!)} accessibilityRole="button" style={[styles.card, styles.notifRow, it.status === 'unread' && styles.cardUnread]}>
      <View style={styles.notifIcon}><Feather name={notifIcon(it.notif!.kind)} size={15} color={colors.chambray} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{it.notif!.title} <Text style={styles.titleLight}>{it.notif!.message}</Text></Text>
        <Text style={styles.meta}>{timeAgo(it.created_at, lang)}</Text>
      </View>
      {!!it.notif!.action_url && !it.notif!.action_url.startsWith('/inbox') && <Feather name="chevron-right" size={16} color={colors.clay} />}
    </Pressable>
  ) : it.kind === 'inv' ? (
    <View key={it.key} style={styles.card} testID={`inv-${it.key}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {avatar(it.inv!.from)}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{it.inv!.from?.pseudo || t('Une lectrice')} <Text style={styles.titleLight}>{it.inv!.kind === 'board' ? t('t’invite sur le tableau') : t('t’invite dans le club')}</Text></Text>
          <Text style={styles.target}>{it.inv!.target_name}</Text>
          <Text style={styles.meta}>{timeAgo(it.created_at, lang)}{it.inv!.message ? `  ·  « ${it.inv!.message} »` : ''}</Text>
        </View>
      </View>
      {it.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          <Pressable testID={`inv-accept-${it.key}`} onPress={() => decideInv(it.inv!, 'accept')} accessibilityRole="button" style={styles.primary}><Text style={styles.primaryText}>{t('Rejoindre')}</Text></Pressable>
          <Pressable testID={`inv-decline-${it.key}`} onPress={() => decideInv(it.inv!, 'decline')} accessibilityRole="button" style={styles.ghost}><Text style={styles.ghostText}>{t('Décliner')}</Text></Pressable>
        </View>
      ) : (
        <Pressable onPress={() => it.status === 'accepted' && openTarget(it.inv!)} style={{ marginTop: spacing.sm }}>
          <Text style={styles.state}>{it.status === 'accepted' ? t('Rejoint  ›') : t('Déclinée')}</Text>
        </Pressable>
      )}
    </View>
  ) : (
    <View key={it.key} style={styles.card} testID={`reco-${it.key}`}>
      <Pressable onPress={() => it.reco!.book && router.push({ pathname: '/discover/book', params: { catalog_id: it.reco!.book.catalog_id, title: it.reco!.book.title, author: it.reco!.book.author || '', cover: it.reco!.book.cover || '', summary: it.reco!.book.summary || '' } })} style={{ flexDirection: 'row', gap: spacing.md }}>
        <BookCover uri={it.reco!.book?.cover} title={it.reco!.book?.title || ''} width={56} height={82} radius={6} initialSize={22} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {avatar(it.reco!.from)}
            <Text style={styles.from} numberOfLines={1}>{t('{pseudo} te recommande', { pseudo: it.reco!.from?.pseudo || t('Une lectrice') })}  ·  {timeAgo(it.created_at, lang)}</Text>
          </View>
          <Text style={styles.target} numberOfLines={2}>{it.reco!.book?.title || t('Livre indisponible')}</Text>
          {!!it.reco!.book?.author && <Text style={styles.meta} numberOfLines={1}>{it.reco!.book.author}</Text>}
          {!!it.reco!.message && <Text style={styles.message}>« {it.reco!.message} »</Text>}
        </View>
      </Pressable>
      {it.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          <Pressable testID={`reco-accept-${it.key}`} onPress={() => decideReco(it.reco!, true)} accessibilityRole="button" style={styles.primary}>
            <Feather name="bookmark" size={14} color={colors.creme} /><Text style={styles.primaryText}>{t('Ajouter à lire')}</Text>
          </Pressable>
          <Pressable testID={`reco-ignore-${it.key}`} onPress={() => decideReco(it.reco!, false)} accessibilityRole="button" style={styles.ghost}><Text style={styles.ghostText}>{t('Ignorer')}</Text></Pressable>
        </View>
      ) : (
        <Text style={styles.state}>{it.status === 'accepted' ? t('Ajouté à ta liste') : t('Ignoré')}</Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-inbox">
      <ScreenHeader title={t('Notifications')} backTestID="inbox-back" />
      <View style={styles.segments} accessibilityRole="tablist">
        {([['all', 'Tout'], ['notif', 'Activité'], ['reco', 'Livres'], ['inv', 'Invitations']] as const).map(([k, label]) => (
          <Pressable key={k} testID={`inbox-filter-${k}`} onPress={() => setFilter(k)} accessibilityRole="tab" accessibilityState={{ selected: filter === k }} style={[styles.seg, filter === k && styles.segOn]}>
            <Text style={[styles.segText, filter === k && styles.segTextOn]}>{t(label)}</Text>
          </Pressable>
        ))}
      </View>
      {items === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader size={56} /></View>
      ) : error && items.length === 0 ? (
        <ErrorState onRetry={load} testID="inbox-error" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.xxl }}>
          {shown.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Text style={styles.emptyTitle}>{t('Rien pour l’instant.')}</Text>
              <Text style={styles.emptySub}>{t('Les cœurs et commentaires sur tes citations, les nouvelles abonnées, tes clubs, les invitations et les livres qu’on te recommande arrivent ici.')}</Text>
            </View>
          ) : (
            <>
              {pending.map(card)}
              {pending.length === 0 && <Text style={styles.emptySub}>{t('Rien de nouveau. Tes réponses passées sont ci-dessous.')}</Text>}
              {past.length > 0 && <Text style={styles.sectionLabel}>{t('Déjà vues')}</Text>}
              {past.map(card)}
            </>
          )}
        </ScrollView>
      )}
      <Toast visible={!!toast} text={toast?.text || ''} actionLabel={toast?.bookId ? t('Voir') : undefined} onAction={() => { const id = toast?.bookId; setToast(null); if (id) router.push({ pathname: '/book/[id]', params: { id } }); }} onHide={() => setToast(null)} testID="toast-inbox" />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  segments: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  seg: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, justifyContent: 'center' },
  segOn: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  segText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.espresso },
  segTextOn: { color: colors.creme, fontFamily: fonts.bodyMedium },
  card: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginBottom: spacing.sm },
  cardUnread: { borderColor: colors.chambray },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.espresso },
  title: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  titleLight: { fontFamily: fonts.body, color: colors.clay },
  from: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, flexShrink: 1 },
  target: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso, marginTop: 2, lineHeight: 21 },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 2 },
  message: { fontFamily: fonts.display, fontSize: 14.5, color: colors.espresso, marginTop: 6, lineHeight: 20 },
  primary: { flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.creme },
  ghost: { flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.espresso },
  state: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray, marginTop: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
