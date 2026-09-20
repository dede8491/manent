import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';
import { InviteSheet } from '@/src/components/InviteSheet';
import { shareUrl } from '@/src/share';
import { ErrorState } from '@/src/components/ErrorState';
import { Toast } from '@/src/components/Toast';
import { GhostButton } from '@/src/components/Button';

export default function BoardDetail() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<any>(null);
  const [invite, setInvite] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 'private' : tableau privé d'une autre lectrice (403) ; 'error' : panne, on propose de réessayer.
  const [loadError, setLoadError] = useState<null | 'private' | 'error'>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try { setBoard(await api<any>(`/boards/${id}`)); }
    catch (e: any) { setLoadError(e?.status === 403 ? 'private' : 'error'); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!board || loadError === 'private') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }} testID="screen-board-loading">
        {loadError === 'private' ? (
          <View style={styles.privateBox} testID="board-private">
            <Feather name="lock" size={22} color={colors.clay} />
            <Text style={styles.privateTitle}>{t('Ce tableau est privé.')}</Text>
            <GhostButton title={t('Retour')} onPress={() => router.back()} testID="board-private-back" />
          </View>
        ) : loadError === 'error' ? <ErrorState onRetry={load} testID="board-error" /> : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-board">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="board-back" style={styles.iconBtn}><Feather name="chevron-left" size={22} color={colors.espresso} /></Pressable>
        <Text style={styles.h1} numberOfLines={1}>{board.name}</Text>
        <Pressable onPress={() => setInvite(true)} testID="board-share" style={styles.iconBtn}><Feather name="share" size={19} color={colors.espresso} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
        <Text style={styles.meta}>{board.visibility === 'private' ? t('PRIVÉ') : board.visibility === 'public' ? t('PUBLIC') : t('COLLABORATIF')}  ·  {t('{n} épingles', { n: board.quotes?.length || 0 })}  ·  {t('{n} membres', { n: board.members_count || 1 })}</Text>
        {board.description ? <Text style={styles.desc}>{board.description}</Text> : null}
        <View style={{ height: spacing.lg }} />
        {(!board.quotes || board.quotes.length === 0) ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
            <Text style={styles.emptyTitle}>{t("Ton premier passage l'attend.")}</Text>
            <Text style={styles.emptySub}>{t('Ouvre une citation et épingle-la ici.')}</Text>
          </View>
        ) : board.quotes.map((q: Quote) => (
          <QuoteCard key={q.quote_id} quote={q} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: q.quote_id } })} />
        ))}
      </ScrollView>
      <InviteSheet
        visible={invite}
        onClose={() => setInvite(false)}
        kind="board"
        targetId={board.board_id}
        name={board.name}
        link={shareUrl.board(board.share_slug, board.invite_code)}
        code={board.invite_code}
        members={board.members_info}
        isOwner={!!board.is_owner}
        testID="board-invite"
        onRegenerate={async () => {
          try { const r = await api<{ invite_code: string }>(`/boards/${id}/invite-code`, { method: 'POST' }); setBoard((b: any) => ({ ...b, invite_code: r.invite_code })); }
          catch (e: any) {
            // La feuille afficherait « Nouveau code » : on la ferme et on explique par-dessous.
            setInvite(false);
            setToast(e?.status === 403 ? t('Seule la propriétaire du tableau peut faire ça.') : t('Action impossible. Réessaie.'));
          }
        }}
        onLeft={async () => { try { await api(`/boards/${id}/leave`, { method: 'POST' }); setInvite(false); router.back(); } catch { setToast(t('Action impossible. Réessaie.')); } }}
      />
      <Toast visible={!!toast} text={toast || ''} onHide={() => setToast(null)} testID="toast-board" />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, flex: 1, textAlign: 'center', marginHorizontal: spacing.md },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase' },
  desc: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, marginTop: spacing.sm, lineHeight: 22 },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
  privateBox: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  privateTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, textAlign: 'center' },
});
