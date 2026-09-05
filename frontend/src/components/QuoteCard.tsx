import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';

export type Quote = {
  quote_id: string;
  text: string;
  page?: number | null;
  chapter?: number | null;
  themes?: string[];
  is_owner?: boolean;
  book?: { title?: string; author?: string; type?: string } | null;
  author?: { pseudo?: string; handle?: string } | null;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
};

export function QuoteCard({ quote, onPress, compact, onPressAuthor, onLike }: { quote: Quote; onPress?: () => void; compact?: boolean; onPressAuthor?: () => void; onLike?: () => void }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const hasStats = quote.likes_count !== undefined || quote.comments_count !== undefined;
  const isWattpad = quote.book?.type === 'wattpad';
  const label = isWattpad ? 'CHAP.' : 'PAGE';
  const num = isWattpad ? quote.chapter : quote.page;
  const source = quote.book?.title || 'Sans titre'; // titre = donnée, laissé tel quel
  const authorLine = quote.book?.author ? `${quote.book.author}` : '';
  const handle = quote.author?.handle ? `@${quote.author.handle}` : '';

  return (
    <Pressable onPress={onPress} testID={`quote-card-${quote.quote_id}`} style={styles.card}>
      <Text style={styles.quoteMark}>&ldquo;</Text>
      <Text style={styles.quoteText} numberOfLines={compact ? 6 : undefined}>{quote.text}</Text>
      <View style={styles.divider} />
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.source} numberOfLines={1}>{source}</Text>
          {!!authorLine && <Text style={styles.author} numberOfLines={1}>{authorLine}</Text>}
        </View>
        {num ? (
          <View style={styles.pageBox}>
            <Text style={styles.pageNum}>{num}</Text>
            <Text style={styles.pageLabel}>{label}</Text>
          </View>
        ) : null}
      </View>
      {(handle || quote.themes?.length || hasStats) ? (
        <View style={[styles.metaRow, { flexDirection: 'row', alignItems: 'center' }]}>
          <Pressable style={{ flex: 1 }} onPress={onPressAuthor} disabled={!onPressAuthor} hitSlop={6}>
            <Text style={styles.brand}>Manent{handle ? `  ·  ${handle}` : ''}</Text>
          </Pressable>
          {hasStats && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable testID={`quote-like-${quote.quote_id}`} onPress={onLike} disabled={!onLike} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Feather name="heart" size={13} color={quote.liked_by_me ? '#B3552F' : colors.clay} />
                <Text style={[styles.stat, quote.liked_by_me && { color: '#B3552F' }]}>{quote.likes_count || 0}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Feather name="message-circle" size={13} color={colors.clay} />
                <Text style={styles.stat}>{quote.comments_count || 0}</Text>
              </View>
            </View>
          )}
        </View>
      ) : null}
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
  footer: { flexDirection: 'row', alignItems: 'flex-end' },
  source: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.6, textTransform: 'uppercase' },
  author: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
  pageBox: { alignItems: 'flex-end' },
  pageNum: { fontFamily: fonts.displayMedium, fontSize: 34, color: colors.espresso, lineHeight: 36 },
  pageLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 2 },
  metaRow: { marginTop: spacing.sm },
  brand: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  stat: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay },
});
