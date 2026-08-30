import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/src/theme';

export type ShareVariant = 'papier' | 'encre' | 'glacier';

type Props = { quote: any; variant: ShareVariant };

// Quote card 1080×1350 rendue hors écran pour l'export image (Instagram / WhatsApp).
export const ShareQuoteCard = forwardRef<View, Props>(({ quote, variant }, ref) => {
  const bg = variant === 'encre' ? colors.espresso : variant === 'glacier' ? colors.glacier : colors.bisque;
  const fg = variant === 'encre' ? colors.creme : colors.espresso;
  const sub = variant === 'encre' ? 'rgba(245,237,228,0.85)' : colors.clay;
  const len = (quote.text || '').length;
  const size = len > 500 ? 42 : len > 320 ? 50 : len > 180 ? 58 : len > 90 ? 66 : 74;
  const isWattpad = quote.book?.type === 'wattpad';
  const num = isWattpad ? quote.chapter : quote.page;

  return (
    <View ref={ref} collapsable={false} style={[styles.canvas, { backgroundColor: bg }]}>
      <Text style={styles.mark}>&ldquo;</Text>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[styles.text, { color: fg, fontSize: size, lineHeight: Math.round(size * 1.35) }]}>{quote.text}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: variant === 'encre' ? colors.clay : colors.borderSoft }]} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.source, { color: sub }]} numberOfLines={2}>{(quote.book?.title || 'SANS TITRE').toUpperCase()}</Text>
          {!!quote.book?.author && <Text style={[styles.author, { color: sub }]} numberOfLines={1}>{quote.book.author}</Text>}
        </View>
        {num ? (
          <View style={{ alignItems: 'flex-end', marginLeft: 40 }}>
            <Text style={[styles.pageNum, { color: fg }]}>{num}</Text>
            <Text style={[styles.pageLbl, { color: sub }]}>{isWattpad ? 'CHAP.' : 'PAGE'}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.brand, { color: sub }]}>MANENT{quote.author?.handle ? `  ·  @${String(quote.author.handle).toUpperCase()}` : ''}</Text>
    </View>
  );
});

ShareQuoteCard.displayName = 'ShareQuoteCard';

const styles = StyleSheet.create({
  canvas: { width: 1080, height: 1350, paddingHorizontal: 96, paddingTop: 64, paddingBottom: 88 },
  mark: { fontFamily: fonts.displayMedium, fontSize: 230, lineHeight: 200, marginLeft: -14, marginBottom: -20, color: colors.chambray },
  text: { fontFamily: fonts.display },
  divider: { height: 2, opacity: 0.4, marginVertical: 52 },
  source: { fontFamily: fonts.bodyMedium, fontSize: 30, letterSpacing: 5 },
  author: { fontFamily: fonts.body, fontSize: 30, marginTop: 10 },
  pageNum: { fontFamily: fonts.displayMedium, fontSize: 108, lineHeight: 110 },
  pageLbl: { fontFamily: fonts.bodyMedium, fontSize: 26, letterSpacing: 6 },
  brand: { fontFamily: fonts.bodyMedium, fontSize: 26, letterSpacing: 6, marginTop: 48 },
});
