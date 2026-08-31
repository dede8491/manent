import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';

type Fiche = { book_id: string; title: string; author?: string; rating?: number; updated_at?: string; has_summary?: boolean };

export default function Carnet() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [fiches, setFiches] = useState<Fiche[] | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [st, f] = await Promise.all([
          api<{ is_premium: boolean }>('/premium/status'),
          api<{ fiches: Fiche[] }>('/fiches'),
        ]);
        setIsPremium(st.is_premium);
        setFiches(f.fiches);
      } catch {}
    })();
  }, []));

  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(); } catch { return ''; }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-carnet">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="carnet-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Carnet de lecture')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isPremium === null || fiches === null ? (
        <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.chambray} />
        </View>
      ) : !isPremium ? (
        <View style={styles.lockBox} testID="carnet-locked">
          <Feather name="lock" size={26} color={colors.chambray} />
          <Text style={styles.lockTitle}>{t('Ton carnet de lecture')}</Text>
          <Text style={styles.lockText}>{t('Retrouve toutes tes fiches de lecture au même endroit, exporte-les en PDF et partage-les. Réservé aux membres Premium.')}</Text>
          <Pressable testID="carnet-premium-cta" onPress={() => router.push('/premium')} style={styles.premiumBtn}>
            <Text style={styles.premiumBtnText}>{t('Découvrir Premium')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          <Text style={styles.h1}>{t('Tes fiches de lecture')}</Text>
          {fiches.length === 0 ? (
            <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Ton carnet est encore vierge.')}</Text>
              <Text style={styles.emptySub}>{t('Ouvre un livre de ta bibliothèque et commence sa fiche de lecture.')}</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {fiches.map(f => (
                <Pressable
                  key={f.book_id}
                  testID={`carnet-fiche-${f.book_id}`}
                  onPress={() => router.push({ pathname: '/fiche/[bookId]', params: { bookId: f.book_id } })}
                  style={styles.card}
                >
                  <View style={styles.cover}><Text style={styles.coverInitial}>{(f.title?.[0] || 'M').toUpperCase()}</Text></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{f.title}</Text>
                    {!!f.author && <Text style={styles.cardMeta} numberOfLines={1}>{f.author}</Text>}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {(f.rating || 0) > 0 && (
                        <View style={{ flexDirection: 'row', gap: 1 }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <Ionicons key={n} name={n <= (f.rating || 0) ? 'star' : 'star-outline'} size={11} color={n <= (f.rating || 0) ? colors.chambray : colors.bisque} />
                          ))}
                        </View>
                      )}
                      {!!f.updated_at && <Text style={styles.cardDate}>{fmtDate(f.updated_at)}</Text>}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.clay} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso },
  lockBox: { margin: spacing.xl, backgroundColor: colors.creme, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  lockTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, textAlign: 'center' },
  lockText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, textAlign: 'center', lineHeight: 20 },
  premiumBtn: { marginTop: spacing.sm, height: 46, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  premiumBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  cover: { width: 44, height: 60, borderRadius: 6, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  coverInitial: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  cardTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  cardMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay },
  cardDate: { fontFamily: fonts.body, fontSize: 11, color: colors.clay },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
