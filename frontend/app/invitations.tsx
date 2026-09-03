import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT, useLang } from '@/src/i18n';
import { timeAgo } from '@/src/timeago';
import ManentLoader from '@/src/components/ManentLoader';

// Invitations reçues : rejoindre un tableau ou un club en un geste, ou décliner.
export default function InvitationsScreen() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rows, setRows] = useState<any[] | null>(null);
  const load = useCallback(async () => { try { setRows((await api<{ invitations: any[] }>('/invitations')).invitations || []); } catch { setRows([]); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = async (inv: any, action: 'accept' | 'decline') => {
    try {
      const r = await api<any>(`/invitations/${inv.invite_id}/${action}`, { method: 'POST' });
      setRows(prev => (prev || []).map(x => x.invite_id === inv.invite_id ? { ...x, status: action === 'accept' ? 'accepted' : 'declined' } : x));
      if (action === 'accept') router.push(r.kind === 'board' ? { pathname: '/board/[id]', params: { id: r.target_id } } : { pathname: '/club/[id]', params: { id: r.target_id } });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-invitations">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="inv-back" style={styles.iconBtn}><Feather name="chevron-left" size={22} color={colors.espresso} /></Pressable>
        <Text style={styles.h1}>{t('Invitations')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {rows === null ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          {rows.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Text style={styles.emptyTitle}>{t('Aucune invitation.')}</Text>
              <Text style={styles.emptySub}>{t('Quand une lectrice t’invite sur un tableau ou dans un club, tu la retrouves ici.')}</Text>
            </View>
          ) : rows.map(inv => (
            <View key={inv.invite_id} style={styles.card} testID={`inv-${inv.invite_id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {inv.from?.picture ? <Image source={{ uri: inv.from.picture }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.initial}>{(inv.from?.pseudo?.[0] || 'M').toUpperCase()}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{inv.from?.pseudo || t('Une lectrice')} <Text style={styles.titleLight}>{inv.kind === 'board' ? t('t’invite sur le tableau') : t('t’invite dans le club')}</Text></Text>
                  <Text style={styles.target}>{inv.target_name}</Text>
                  <Text style={styles.meta}>{timeAgo(inv.created_at, lang)}{inv.message ? `  ·  « ${inv.message} »` : ''}</Text>
                </View>
              </View>
              {inv.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
                  <Pressable testID={`inv-accept-${inv.invite_id}`} onPress={() => decide(inv, 'accept')} style={styles.primary}><Text style={styles.primaryText}>{t('Rejoindre')}</Text></Pressable>
                  <Pressable testID={`inv-decline-${inv.invite_id}`} onPress={() => decide(inv, 'decline')} style={styles.ghost}><Text style={styles.ghostText}>{t('Décliner')}</Text></Pressable>
                </View>
              ) : (
                <Pressable onPress={() => inv.status === 'accepted' && router.push(inv.kind === 'board' ? { pathname: '/board/[id]', params: { id: inv.target_id } } : { pathname: '/club/[id]', params: { id: inv.target_id } })} style={{ marginTop: spacing.sm }}>
                  <Text style={styles.state}>{inv.status === 'accepted' ? t('Rejoint  ›') : t('Déclinée')}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  card: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.espresso },
  title: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  titleLight: { fontFamily: fonts.body, color: colors.clay },
  target: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 2 },
  primary: { flex: 1, height: 40, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.creme },
  ghost: { flex: 1, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.espresso },
  state: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
