import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions, ActivityIndicator, Share, Platform , Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';

type Profile = {
  user: { pseudo: string; handle: string; picture?: string };
  is_me: boolean;
  is_following: boolean;
  stats: { public_quotes: number; books: number; boards: number; followers: number };
  quotes: Quote[];
};

export default function ReaderProfile() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [followBusy, setFollowBusy] = useState(false);

  const toggleFollow = async () => {
    if (!profile || followBusy) return;
    setFollowBusy(true);
    try {
      const r = await api<{ following: boolean; followers: number }>(`/readers/${encodeURIComponent(handle)}/follow`, { method: 'POST' });
      setProfile({ ...profile, is_following: r.following, stats: { ...profile.stats, followers: r.followers } });
    } catch {} finally {
      setFollowBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api<Profile>(`/readers/${encodeURIComponent(handle)}`);
        setProfile(r);
      } catch {
        setNotFound(true);
      }
    })();
  }, [handle]);

  const shareProfile = async () => {
    if (!profile) return;
    const url = `manent.app/@${profile.user.handle}`;
    const message = t('Découvre les lectures de {pseudo} sur Manent — {url}', { pseudo: profile.user.pseudo, url });
    try {
      if (Platform.OS === 'web') {
        const nav: any = navigator;
        if (nav.share) {
          await nav.share({ title: 'Manent', text: message });
        } else if (nav.clipboard) {
          await nav.clipboard.writeText(message);
          setFeedback(t('Lien copié dans le presse-papiers.'));
        } else {
          setFeedback(url);
        }
      } else {
        await Share.share({ message });
      }
    } catch {
      setFeedback(url);
    }
  };

  const colWidth = (width - spacing.xl * 2 - spacing.md) / 2;
  const col1: Quote[] = [], col2: Quote[] = [];
  (profile?.quotes || []).forEach((x, i) => (i % 2 === 0 ? col1 : col2).push(x));
  const goQuote = (id: string) => router.push({ pathname: '/quote/[id]', params: { id } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-reader">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="reader-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Lecteur')}</Text>
        <Pressable onPress={shareProfile} testID="reader-share" style={styles.iconBtn}>
          <Feather name="share" size={19} color={colors.espresso} />
        </Pressable>
      </View>

      {notFound ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={styles.emptyTitle}>{t('Ce lecteur reste introuvable.')}</Text>
        </View>
      ) : !profile ? (
        <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.chambray} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              {profile.user.picture ? (
                <Image source={{ uri: profile.user.picture }} style={{ width: 84, height: 84, borderRadius: 42 }} />
              ) : (
                <Text style={styles.avatarInitial}>{(profile.user.pseudo[0] || 'M').toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.pseudo} testID="reader-pseudo">{profile.user.pseudo}</Text>
            <Text style={styles.handle}>@{profile.user.handle}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
              {!profile.is_me && (
                <Pressable
                  testID="btn-follow"
                  onPress={toggleFollow}
                  disabled={followBusy}
                  style={[styles.shareBtn, { marginTop: 0 }, profile.is_following && styles.followingBtn]}
                >
                  <Feather name={profile.is_following ? 'check' : 'user-plus'} size={14} color={profile.is_following ? colors.espresso : colors.creme} />
                  <Text style={[styles.shareBtnText, profile.is_following && { color: colors.espresso }]}>
                    {profile.is_following ? t('Suivi') : t('Suivre')}
                  </Text>
                </Pressable>
              )}
              <Pressable testID="btn-share-profile" onPress={shareProfile} style={[styles.shareBtn, { marginTop: 0 }, !profile.is_me && styles.followingBtn]}>
                <Feather name="share" size={14} color={!profile.is_me ? colors.espresso : colors.creme} />
                <Text style={[styles.shareBtnText, !profile.is_me && { color: colors.espresso }]}>{t('Partager le profil')}</Text>
              </Pressable>
            </View>
            {feedback ? <Text style={styles.feedback} testID="reader-feedback">{feedback}</Text> : null}
          </View>

          <View style={styles.statsRow}>
            {[
              { n: profile.stats.followers, l: t(profile.stats.followers > 1 ? 'abonnés' : 'abonné') },
              { n: profile.stats.public_quotes, l: t(profile.stats.public_quotes > 1 ? 'citations' : 'citation') },
              { n: profile.stats.books, l: t(profile.stats.books > 1 ? 'livres' : 'livre') },
              { n: profile.stats.boards, l: t(profile.stats.boards > 1 ? 'tableaux' : 'tableau') },
            ].map(s => (
              <View key={s.l} style={styles.statCard}>
                <Text style={styles.statNum}>{s.n}</Text>
                <Text style={styles.statLbl}>{s.l}</Text>
              </View>
            ))}
          </View>

          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
            <Text style={styles.sectionLabel}>{t('Citations publiques')}</Text>
            {profile.quotes.length === 0 ? (
              <Text style={styles.emptySub}>{t('Rien de public pour l’instant.')}</Text>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ width: colWidth, gap: spacing.md }}>
                  {col1.map(x => <QuoteCard key={x.quote_id} quote={x} compact onPress={() => goQuote(x.quote_id)} />)}
                </View>
                <View style={{ width: colWidth, gap: spacing.md }}>
                  {col2.map(x => <QuoteCard key={x.quote_id} quote={x} compact onPress={() => goQuote(x.quote_id)} />)}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  hero: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.xl },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.displayMedium, fontSize: 42, color: colors.espresso },
  pseudo: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso, marginTop: spacing.md },
  handle: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: 2 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.chambray, marginTop: spacing.md },
  shareBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  followingBtn: { backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft },
  feedback: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl },
  statCard: { flex: 1, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', paddingVertical: spacing.md },
  statNum: { fontFamily: fonts.displayMedium, fontSize: 28, color: colors.espresso },
  statLbl: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay },
});
