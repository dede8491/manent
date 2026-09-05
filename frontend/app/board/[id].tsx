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

export default function BoardDetail() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<any>(null);
  const [invite, setInvite] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => { const b = await api<any>(`/boards/${id}`); setBoard(b); })();
  }, [id]));

  if (!board) return <View style={{ flex: 1, backgroundColor: colors.glacier }} />;

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
        onRegenerate={async () => { const r = await api<{ invite_code: string }>(`/boards/${id}/invite-code`, { method: 'POST' }); setBoard((b: any) => ({ ...b, invite_code: r.invite_code })); }}
        onLeft={async () => { try { await api(`/boards/${id}/leave`, { method: 'POST' }); setInvite(false); router.back(); } catch {} }}
      />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, flex: 1, textAlign: 'center', marginHorizontal: spacing.md },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase' },
  desc: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, marginTop: spacing.sm, lineHeight: 22 },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
