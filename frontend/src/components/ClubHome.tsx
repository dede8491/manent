import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { ClubCard } from '@/src/components/ClubCard';
import { useT } from '@/src/i18n';

// Onglet Club : tes clubs, créer (Premium) / rejoindre par code, clubs publics.
// Plus aucun appel au club global (/api/club) : chaque club porte ses propres contenus.
export function ClubHome({ clubs, onOpenClub, onCreateClub, onJoinClub }: {
  clubs: any[];
  onOpenClub: (id: string) => void;
  onCreateClub: () => void;
  onJoinClub: () => void;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [premium, setPremium] = useState<boolean | null>(null);
  const [pubClubs, setPubClubs] = useState<any[]>([]);
  const [joining, setJoining] = useState<string | null>(null);

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try {
        const st = await api<{ is_premium: boolean }>('/premium/status');
        setPremium(st.is_premium);
      } catch { setPremium(true); }
      try {
        const pc = await api<{ clubs: any[] }>('/clubs/discover');
        setPubClubs(pc.clubs || []);
      } catch {}
    })();
  }, []));

  const joinPublic = async (cid: string) => {
    if (joining) return;
    setJoining(cid);
    try {
      await api(`/clubs/${cid}/join`, { method: 'POST' });
      setPubClubs(prev => prev.filter(c => c.club_id !== cid));
      onOpenClub(cid);
    } catch {}
    finally { setJoining(null); }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }} testID="club-home">
      <View style={{ marginTop: spacing.xl }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { paddingHorizontal: 0, marginBottom: 0 }]}>{t('Tes clubs')}</Text>
          <InfoTooltip
            testID="info-clubs"
            title={t('Comment ça marche')}
            text={t("Un club de lecture a ses lectures communes, ses sondages, ses événements et ses messages. Fermé (cadenas), il ne s'ouvre qu'avec son code d'invitation — parfait entre amis ou en famille. Public (globe), il apparaît dans « Clubs publics à rejoindre » et toute la communauté peut y entrer librement. Avec ton abonnement, tu peux en créer autant que tu veux.")}
          />
        </View>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
          {clubs.map((item: any) => (
            <Pressable key={item.club_id} testID={`club-${item.club_id}`} onPress={() => onOpenClub(item.club_id)} style={({ pressed }) => [styles.clubCard, pressed && { opacity: 0.85 }]}>
              <View style={styles.clubAvatar}>
                <Feather name={item.visibility === 'public' ? 'globe' : 'lock'} size={15} color={colors.chambray} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.clubName} numberOfLines={1}>{item.name}</Text>
                  {item.is_owner && <Text style={styles.ownerBadge}>{t('TON CLUB')}</Text>}
                </View>
                <Text style={styles.clubMeta}>
                  {item.visibility === 'public' ? t('PUBLIC') : t('FERMÉ')} · {item.members_count} {t(item.members_count > 1 ? 'MEMBRES' : 'MEMBRE')} · {item.messages_count} {t(item.messages_count > 1 ? 'MESSAGES' : 'MESSAGE')}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.clay} />
            </Pressable>
          ))}
          {clubs.length === 0 && (
            <View style={styles.clubEmpty}>
              <Text style={styles.emptyTitle}>{t('Ton premier club t’attend.')}</Text>
              <Text style={styles.emptySub}>{t('Crée-le fermé pour tes proches, ou public pour toute la communauté.')}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable testID="btn-new-club" onPress={() => (premium ? onCreateClub() : router.push('/premium'))} style={[styles.clubAction, { flex: 1 }]}>
              <Feather name={premium ? 'plus' : 'lock'} size={16} color={colors.chambray} />
              <Text style={styles.clubActionText}>{t('Créer un club')}</Text>
            </Pressable>
            <Pressable testID="btn-join-club" onPress={onJoinClub} style={[styles.clubAction, { flex: 1 }]}>
              <Feather name="key" size={15} color={colors.chambray} />
              <Text style={styles.clubActionText}>{t('J’ai un code')}</Text>
            </Pressable>
          </View>
        </View>

        {pubClubs.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.sectionLabel}>{t('Clubs publics à rejoindre')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
              {pubClubs.map((c: any) => (
                <ClubCard key={c.club_id} testID={`pub-club-${c.club_id}`} club={c} joining={joining === c.club_id} onJoin={() => joinPublic(c.club_id)} />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textAlign: 'center', marginTop: 4 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  clubCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  clubAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glacier, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ownerBadge: { fontFamily: fonts.bodyMedium, fontSize: 8, color: colors.creme, backgroundColor: colors.clay, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  clubEmpty: { alignItems: 'center', paddingVertical: spacing.lg, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderSoft, paddingHorizontal: spacing.md },
  clubName: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  clubMeta: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1, marginTop: 3 },
  clubAction: { height: 44, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.creme },
  clubActionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
});
