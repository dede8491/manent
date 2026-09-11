import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import { Avatar } from '@/src/components/Avatar';

export type Quote = {
  quote_id: string;
  text: string;
  page?: number | null;
  chapter?: number | null;
  themes?: string[];
  is_owner?: boolean;
  book?: { title?: string; author?: string; type?: string } | null;
  author?: { pseudo?: string; handle?: string; picture?: string | null } | null;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
};

// Carte de citation. Sous le texte : la lectrice qui l'a gardée (petit avatar rond + pseudo), un tap ouvre son profil.
// Si l'écran ne passe pas onPressAuthor, la carte navigue elle-même vers /reader/[handle].
export function QuoteCard({ quote, onPress, compact, onPressAuthor, onLike }: { quote: Quote; onPress?: () => void; compact?: boolean; onPressAuthor?: () => void; onLike?: () => void }) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const router = useRouter();
  const hasStats = quote.likes_count !== undefined || quote.comments_count !== undefined;
  const isWattpad = quote.book?.type === 'wattpad';
  const label = isWattpad ? 'CHAP.' : 'PAGE';
  const num = isWattpad ? quote.chapter : quote.page;
  const source = quote.book?.title || 'Sans titre'; // titre = donnée, laissé tel quel
  const authorLine = quote.book?.author ? `${quote.book.author}` : '';
  const handle = quote.author?.handle || '';
  const reader = quote.author?.pseudo || (handle ? `@${handle}` : '');
  const openAuthor = onPressAuthor || (handle ? () => router.push({ pathname: '/reader/[handle]', params: { handle } }) : undefined);

  return (
    <Pressable onPress={onPress} testID={`quote-card-${quote.quote_id}`} accessibilityRole={onPress ? 'button' : undefined} style={styles.card}>
      <Text style={styles.quoteMark}>&ldquo;</Text>
      <Text style={styles.quoteText} numberOfLines={compact ? 6 : undefined}>{quote.text}</Text>
      <View style={styles.divider} />
      {/* Source : titre complet (deux lignes), auteur, et la page. En grille, la page reste discrète (« p. 89 »)
          pour laisser toute la largeur au titre ; en pleine largeur, le grand chiffre de page est conservé. */}
      <View style={styles.footer}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.source} numberOfLines={2}>{source}</Text>
          {!!authorLine && <Text style={styles.author} numberOfLines={1}>{authorLine}</Text>}
          {compact && num ? <Text style={styles.pageInline}>{isWattpad ? t('chap. {n}', { n: num }) : t('p. {n}', { n: num })}</Text> : null}
        </View>
        {!compact && num ? (
          <View style={styles.pageBox}>
            <Text style={styles.pageNum}>{num}</Text>
            <Text style={styles.pageLabel}>{label}</Text>
          </View>
        ) : null}
      </View>
      {reader ? (
        <Pressable
          testID={`quote-author-${quote.quote_id}`}
          onPress={openAuthor}
          disabled={!openAuthor}
          hitSlop={6}
          accessibilityRole={openAuthor ? 'button' : undefined}
          accessibilityLabel={openAuthor ? t('Voir le profil de {pseudo}', { pseudo: reader }) : reader}
          style={styles.readerRow}
        >
          <Avatar uri={quote.author?.picture} name={quote.author?.pseudo} size={compact ? 34 : 36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.reader} numberOfLines={2}>{reader}</Text>
            {!!handle && quote.author?.pseudo ? <Text style={styles.readerHandle} numberOfLines={1}>@{handle}</Text> : null}
          </View>
        </Pressable>
      ) : null}
      {hasStats && (
        <View style={styles.statsRow}>
          <Pressable testID={`quote-like-${quote.quote_id}`} onPress={onLike} disabled={!onLike} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Aimer')} accessibilityState={{ selected: !!quote.liked_by_me }} style={styles.statItem}>
            <Feather name="heart" size={14} color={quote.liked_by_me ? colors.danger : colors.clay} />
            <Text style={[styles.stat, quote.liked_by_me && { color: colors.danger }]}>{quote.likes_count || 0}</Text>
          </Pressable>
          <View style={styles.statItem}>
            <Feather name="message-circle" size={14} color={colors.clay} />
            <Text style={styles.stat}>{quote.comments_count || 0}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  card: {
    backgroundColor: colors.bisque,
    borderRadius: radius.md,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  quoteMark: {
    fontFamily: fonts.displayMedium,
    fontSize: 64,
    color: colors.chambray,
    lineHeight: 60,
    marginBottom: -8,
    marginLeft: -4,
  },
  quoteText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 28, color: colors.espresso },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.md, opacity: 0.5 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  source: { fontFamily: fonts.displayMedium, fontSize: 15, lineHeight: 19, color: colors.espresso },
  author: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 2 },
  pageInline: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  pageBox: { alignItems: 'flex-end', flexShrink: 0 },
  pageNum: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso, lineHeight: 36 },
  pageLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 2 },
  readerRow: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  reader: { fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 17, color: colors.espresso },
  readerHandle: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: spacing.sm },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  stat: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.clay },
});
