import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { useT } from '@/src/i18n';
import ManentLoader from '@/src/components/ManentLoader';
import { ScreenHeader } from '@/src/components/ScreenHeader';

type Fiche = { book_id: string; title: string; author?: string; rating?: number; updated_at?: string; has_summary?: boolean; has_fiche?: boolean; finished?: boolean };

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
      <ScreenHeader title={t('Mes fiches de lecture')} backTestID="carnet-back" />

      {isPremium === null || fiches === null ? (
        <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
          <ManentLoader size={48} />
        </View>
      ) : !isPremium ? (
        <View style={styles.lockBox} testID="carnet-locked">
          <Feather name="lock" size={26} color={colors.chambray} />
          <Text style={styles.lockTitle}>{t('Tes fiches de lecture')}</Text>
          <Text style={styles.lockText}>{t('Retrouve toutes tes fiches de lecture au même endroit, exporte-les en PDF et partage-les. Réservé aux membres Premium.')}</Text>
          <Pressable testID="carnet-premium-cta" onPress={() => router.push('/premium')} accessibilityRole="button" style={styles.premiumBtn}>
            <Text style={styles.premiumBtnText}>{t('Découvrir Premium')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
          {fiches.length === 0 ? (
            <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
              <Text style={styles.emptyTitle}>{t('Aucune fiche pour l’instant.')}</Text>
              <Text style={styles.emptySub}>{t('Termine un livre, ou ouvre un livre de ta bibliothèque et commence sa fiche de lecture.')}</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {fiches.map(f => (
                <View key={f.book_id} style={styles.card} testID={`carnet-fiche-${f.book_id}`}>
                  <Pressable
                    testID={`carnet-open-${f.book_id}`}
                    onPress={() => router.push({ pathname: '/fiche/[bookId]', params: { bookId: f.book_id } })}
                    accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                  >
                    <BookCover uri={(f as any).cover} title={f.title} width={44} height={60} initialSize={22} />
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
                  {/* Deux portes par livre : la fiche de lecture (à remplir, exportable) et, s'il est terminé, la fiche de fin (générée depuis le journal). */}
                  <View style={styles.links}>
                    <Text style={styles.linkHint} numberOfLines={1}>{f.has_fiche ? t('Fiche de lecture') : t('Fiche de lecture à commencer')}</Text>
                    {f.finished && (
                      <Pressable testID={`carnet-wrapup-${f.book_id}`} onPress={() => router.push({ pathname: '/journal/wrapup/[bookId]', params: { bookId: f.book_id } })} accessibilityRole="button" hitSlop={6} style={styles.linkBtn}>
                        <Feather name="award" size={12} color={colors.chambray} />
                        <Text style={styles.linkText} numberOfLines={1}>{t('Fiche de fin de livre')}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  h1: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso },
  lockBox: { margin: spacing.xl, backgroundColor: colors.creme, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  lockTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, textAlign: 'center' },
  lockText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, textAlign: 'center', lineHeight: 20 },
  premiumBtn: { marginTop: spacing.sm, height: 46, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  premiumBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  card: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  linkHint: { flexShrink: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.clay },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 30, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, flexShrink: 0 },
  linkText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.chambray },
  cardTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  cardMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay },
  cardDate: { fontFamily: fonts.body, fontSize: 11, color: colors.clay },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
