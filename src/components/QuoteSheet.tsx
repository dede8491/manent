import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radii, shadow, spacing } from '@/theme';
import type { BookKind } from '@/types';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Text } from './Text';

interface Props {
  text: string;
  locator: number | null;
  bookTitle: string;
  bookAuthor: string;
  bookKind?: BookKind;
  themes?: string[];
  note?: string;
  /** Auteur de la capture, affiché dans le fil et sur les tableaux. */
  byline?: { pseudo: string; avatarEmoji: string; prefix?: string };
  isPrivate?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * La fiche-citation : élément signature de Manent. Carte blanche à filet
 * vertical vert, citation en serif, numéro de page en Fraunces Black ambre
 * surmonté de « PAGE » — ou « CHAP. » en orange pour une histoire Wattpad.
 */
export function QuoteSheet({
  text, locator, bookTitle, bookAuthor, bookKind = 'papier', themes = [], note,
  byline, isPrivate, onPress, style,
}: Props) {
  const isWattpad = bookKind === 'wattpad';
  const locatorLabel = isWattpad ? 'CHAP.' : 'PAGE';
  const locatorColor = isWattpad ? colors.wattpad : colors.amber;

  return (
    <Card onPress={onPress} accessibilityLabel={`Citation de ${bookTitle}`} style={[styles.card, style]}>
      <View style={styles.body}>
        <View style={[styles.rule, isWattpad && { backgroundColor: colors.wattpad }]} />
        <View style={styles.main}>
          {byline ? (
            <View style={styles.byline}>
              <Avatar emoji={byline.avatarEmoji} size={24} />
              <Text variant="small" style={styles.bylineText}>
                {byline.prefix ? `${byline.prefix} ` : ''}
                {byline.pseudo}
              </Text>
            </View>
          ) : null}

          <Text variant="quote" style={styles.quote}>
            {text}
          </Text>

          <Text variant="small" style={styles.source}>
            {bookTitle} · {bookAuthor}
          </Text>

          {note ? (
            <Text variant="small" style={styles.note}>
              {note}
            </Text>
          ) : null}

          {themes.length > 0 || isPrivate ? (
            <View style={styles.footer}>
              {themes.slice(0, 3).map((t) => (
                <Text key={t} variant="small" color={colors.green} style={styles.theme}>
                  #{t}
                </Text>
              ))}
              {isPrivate ? (
                <Text variant="small" color={colors.muted}>
                  🔒 privée
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {locator != null ? (
          <View style={styles.locator}>
            <Text variant="overline" color={locatorColor}>
              {locatorLabel}
            </Text>
            <Text variant="pageNumber" color={locatorColor}>
              {locator}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', ...shadow.card },
  body: { flexDirection: 'row', alignItems: 'stretch' },
  rule: { width: 4, backgroundColor: colors.green, borderTopLeftRadius: radii.lg, borderBottomLeftRadius: radii.lg },
  main: { flex: 1, padding: spacing.lg, paddingRight: spacing.sm },
  byline: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  bylineText: { marginLeft: spacing.sm },
  quote: { marginBottom: spacing.sm },
  source: { color: colors.inkSoft },
  note: { marginTop: spacing.sm, fontStyle: 'italic' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  theme: { marginRight: spacing.xs },
  locator: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.lg,
    paddingRight: spacing.lg,
    paddingLeft: spacing.sm,
    minWidth: 62,
  },
});
