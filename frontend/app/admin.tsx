import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import ManentLoader from '@/src/components/ManentLoader';
import { AuthorAdmin } from '@/src/components/AuthorAdmin';
import { timeAgo } from '@/src/timeago';
import { useT, useLang } from '@/src/i18n';

export default function AdminDashboard() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [denied, setDenied] = useState(false);
  const [badge, setBadge] = useState<{ reports: number; authors: number } | null>(null);

  const load = useCallback(async () => {
    try { setData(await api('/club/admin/overview')); }
    catch { setDenied(true); }
    try { setBadge(await api('/admin/badge')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resolve = async (reportId: string, action: 'ignore' | 'delete') => {
    try {
      await api(`/club/admin/reports/${reportId}`, { method: 'POST', body: JSON.stringify({ action }) });
      setData((prev: any) => ({ ...prev, reports: prev.reports.filter((r: any) => r.report_id !== reportId) }));
    } catch {}
  };

  const STATS: [string, string][] = [
    ['members', 'Membres'], ['active_members', 'Actifs (7 j)'], ['club_books', 'Livres du Club'],
    ['readings', 'Lectures en cours'], ['finished', 'Lectures terminées'], ['posts', 'Discussions'],
    ['comments', 'Commentaires'], ['reviews', 'Avis'], ['events', 'Événements'], ['polls', 'Sondages'],
    ['quotes_public', 'Citations publiques'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-admin">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="admin-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>{t('Dashboard admin')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {denied ? (
        <Text style={styles.denied}>{t('Réservé à l’administratrice du Club.')}</Text>
      ) : !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader size={56} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={styles.grid}>
            {STATS.map(([key, label]) => (
              <View key={key} style={styles.statCard} testID={`admin-stat-${key}`}>
                <Text style={styles.statNum}>{data.stats[key] ?? 0}</Text>
                <Text style={styles.statLabel}>{t(label)}</Text>
              </View>
            ))}
          </View>

          {badge && (badge.reports > 0 || badge.authors > 0) && (
            <View style={styles.todoBox} testID="admin-todo">
              <Feather name="bell" size={14} color={colors.chambray} />
              <Text style={styles.todoText}>
                {[badge.reports > 0 ? t(badge.reports > 1 ? '{n} signalements' : '{n} signalement', { n: badge.reports }) : null,
                  badge.authors > 0 ? t(badge.authors > 1 ? '{n} auteurs à vérifier' : '{n} auteur à vérifier', { n: badge.authors }) : null].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.sectionTitle}>{t('Signalements à modérer')}</Text>
            {data.reports.length > 0 && <View style={styles.countPill}><Text style={styles.countText}>{data.reports.length}</Text></View>}
          </View>
          {data.reports.length === 0 ? (
            <Text style={styles.empty}>{t('Aucun signalement en attente. Tout va bien.')}</Text>
          ) : data.reports.map((r: any) => (
            <View key={r.report_id} style={styles.reportCard} testID={`admin-report-${r.report_id}`}>
              <Text style={styles.reportMeta}>
                {t(r.kind === 'post' ? 'Discussion' : r.kind === 'comment' ? 'Commentaire' : 'Citation')}
                {r.content_author ? ` ${t('de')} ${r.content_author}` : ''} · {t('signalé par')} {r.reporter || '—'} · {timeAgo(r.created_at, lang)}
              </Text>
              <Text style={styles.reportContent} numberOfLines={3}>{r.content || t('(contenu déjà supprimé)')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
                <Pressable testID={`admin-ignore-${r.report_id}`} onPress={() => resolve(r.report_id, 'ignore')} style={styles.ghostBtn}>
                  <Text style={styles.ghostBtnText}>{t('Ignorer')}</Text>
                </Pressable>
                <Pressable testID={`admin-delete-${r.report_id}`} onPress={() => resolve(r.report_id, 'delete')} style={styles.dangerBtn}>
                  <Feather name="trash-2" size={13} color={colors.creme} />
                  <Text style={styles.dangerBtnText}>{t('Supprimer le contenu')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <AuthorAdmin />
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  denied: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '31%', flexGrow: 1, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, alignItems: 'center' },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  statLabel: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.clay, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 21, color: colors.espresso, marginTop: spacing.xl, marginBottom: spacing.md },
  todoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  todoText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.espresso, flex: 1 },
  countPill: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl - spacing.md },
  countText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.creme },
  empty: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay },
  reportCard: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginBottom: spacing.sm },
  reportMeta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 0.5, textTransform: 'uppercase' },
  reportContent: { fontFamily: fonts.display, fontSize: 15, color: colors.espresso, lineHeight: 21, marginTop: 6 },
  ghostBtn: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.espresso },
  dangerBtn: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: '#B3552F', flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  dangerBtnText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.creme },
});
