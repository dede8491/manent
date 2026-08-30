import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, fonts, quoteCardStyles, spacing, type QuoteCardStyleKey } from '@/theme';
import { Text } from './Text';

export type ShareFormat = 'post' | 'story';

interface Props {
  text: string;
  locator: number | null;
  locatorLabel: string;
  bookTitle: string;
  bookAuthor: string;
  styleKey: QuoteCardStyleKey;
  format: ShareFormat;
  /** Le filigrane disparaît avec Premium. */
  watermark: boolean;
  width: number;
}

/**
 * La quote card exportée en image. Rendue hors écran puis capturée par
 * react-native-view-shot (cf. src/services/share.ts).
 */
export const ShareQuoteCard = forwardRef<View, Props>(function ShareQuoteCard(
  { text, locator, locatorLabel, bookTitle, bookAuthor, styleKey, format, watermark, width },
  ref,
) {
  const s = quoteCardStyles[styleKey];
  const height = format === 'story' ? Math.round((width * 16) / 9) : width;
  const scale = width / 320;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, height, backgroundColor: s.bg, padding: 28 * scale }]}
    >
      <Text style={{ fontFamily: fonts.serifBlack, fontSize: 64 * scale, lineHeight: 66 * scale, color: s.accent }}>
        “
      </Text>

      <View style={styles.middle}>
        <Text
          style={{
            fontFamily: fonts.serifSemi,
            fontSize: (text.length > 220 ? 17 : text.length > 120 ? 20 : 24) * scale,
            lineHeight: (text.length > 220 ? 25 : text.length > 120 ? 29 : 34) * scale,
            color: s.text,
          }}
        >
          {text}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerText}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 13 * scale, color: s.text }}>{bookTitle}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12 * scale, color: s.meta, marginTop: 2 }}>
            {bookAuthor}
          </Text>
        </View>
        {locator != null ? (
          <View style={styles.locator}>
            <Text
              style={{
                fontFamily: fonts.sansBold,
                fontSize: 9 * scale,
                letterSpacing: 1.3,
                color: s.accent,
              }}
            >
              {locatorLabel}
            </Text>
            <Text style={{ fontFamily: fonts.serifBlack, fontSize: 28 * scale, color: s.accent }}>
              {locator}
            </Text>
          </View>
        ) : null}
      </View>

      {watermark ? (
        <Text style={{ fontFamily: fonts.sans, fontSize: 10 * scale, color: s.meta, marginTop: 10 * scale }}>
          capturé avec Manent
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 18, justifyContent: 'flex-start', overflow: 'hidden' },
  middle: { flex: 1, justifyContent: 'center', paddingVertical: spacing.md },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.muted,
    paddingTop: spacing.md,
  },
  footerText: { flex: 1, paddingRight: spacing.md },
  locator: { alignItems: 'flex-end' },
});
