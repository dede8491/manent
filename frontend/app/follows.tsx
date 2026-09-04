import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';

type Row = { pseudo: string; handle: string; picture?: string | null; is_following: boolean; is_me: boolean };

// Abonnées / abonnements — les miens (sans paramètre) ou ceux d'une lectrice (?handle=…).
export default function FollowsScreen() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { handle, tab: tabParam } = useLocalSearchParams<{ handle?: string; tab?: string }>();
  const [tab, setTab] = useState<'followers' | 'following'>(tabParam === 'following' ? 'following' : 'followers');
  const [data, setData] = useState<{ followers: Row[]; following: Row[]; followers_count: number; following_count: number; pseudo?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api(handle ? `/readers/${encodeURIComponent(handle)}/follows` : '/me/follows')); } catch { setData({ followers: [], following: [], followers_count: 0, following_count: 0 }); }
  }, [handle]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (r: Row) => {
    if (busy) return;
    setBusy(r.handle);
    try {
      const res = await api<{ following: boolean }>(`/readers/${encodeURIComponent(r.handle)}/follow`, { method: 'POST' });
      setData(d => d ? { ...d, followers: d.followers.map(x => x.handle === r.handle ? { ...x, is_following: res.following } : x),
                         following: d.following.map(x => x.handle === r.handle ? { ...x, is_following: res.following } : x) } : d);
    } catch {} finally { setBusy(null); }
  };

  const rows = data ? (tab === 'followers' ? data.followers : data.following) : [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-follows">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="follows-back" style={styles.iconBtn}><Feather name="chevron-left" size={22} color={colors.espresso} /></Pressable>
        <Text style={styles.h1} numberOfLines={1}>{data?.pseudo || t('Mes lectrices')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.segRow}>
        {([['followers', t('Abonnées')], ['following', t('Abonnements')]] as const).map(([k, lbl]) => (
          <Pressable key={k} testID={`follows-tab-${k}`} onPress={() => setTab(k)} style={[styles.seg, tab === k && styles.segActive]}>
            <Text style={[styles.segText, tab === k && styles.segTextActive]}>{lbl} · {data ? (k === 'followers' ? data.followers_count : data.following_count) : '…'}</Text>
          </Pressable>
        ))}
      </View>
      {!data ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          {rows.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Text style={styles.emptyTitle}>{tab === 'followers' ? t('Personne pour l’instant.') : t('Aucun abonnement pour l’instant.')}</Text>
              <Text style={styles.emptySub}>{tab === 'followers' ? t('Partage ton profil pour que d’autres lectrices te suivent.') : t('Cherche une lectrice et suis-la pour retrouver ses citations dans ton fil.')}</Text>
            </View>
          ) : rows.map(r => (
            <Pressable key={r.handle} testID={`follows-row-${r.handle}`} onPress={() => router.push({ pathname: '/reader/[handle]', params: { handle: r.handle } })} style={styles.row}>
              {r.picture ? <Image source={{ uri: r.picture }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.initial}>{(r.pseudo?.[0] || 'M').toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.pseudo}</Text>
                <Text style={styles.handle}>@{r.handle}</Text>
              </View>
              {!r.is_me && (
                <Pressable testID={`follows-toggle-${r.handle}`} onPress={() => toggle(r)} style={[styles.btn, r.is_following && styles.btnOn]}>
                  <Text style={[styles.btnText, r.is_following && { color: colors.creme }]}>{busy === r.handle ? '…' : r.is_following ? t('Suivie') : t('Suivre')}</Text>
                </Pressable>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, flex: 1, textAlign: 'center' },
  segRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  seg: { flex: 1, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  segText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  segTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  name: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.espresso },
  handle: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay },
  btn: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  btnOn: { backgroundColor: colors.chambray },
  btnText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
