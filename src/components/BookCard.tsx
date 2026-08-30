import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { daysUntil, percent } from '@/lib/format';
import { colors, radii, spacing } from '@/theme';
import type { Book } from '@/types';
import { Card } from './Card';
import { Pill } from './Pill';
import { ProgressBar } from './ProgressBar';
import { StarRating } from './StarRating';
import { Text } from './Text';

interface Props {
  book: Book;
  quoteCount: number;
  onPress: () => void;
  /** Bouton « Photographier ma dernière page lue », pour les livres en cours. */
  onCapturePage?: () => void;
  footer?: React.ReactNode;
}

/** Couleur de repli déterministe quand le livre n'a pas de couverture. */
function coverTone(title: string): string {
  const tones = [colors.green, colors.study, colors.amber, colors.brick, colors.inkSoft];
  let sum = 0;
  for (let i = 0; i < title.length; i += 1) sum += title.charCodeAt(i);
  return tones[sum % tones.length];
}

export function BookCard({ book, quoteCount, onPress, footer }: Props) {
  const isWattpad = book.kind === 'wattpad';
  const isStudy = book.kind === 'etude';
  const accent = isWattpad ? colors.wattpad : isStudy ? colors.study : colors.green;
  const unitLabel = t(isWattpad ? 'unit.chapter.short' : 'unit.page.short');

  return (
    <Card onPress={onPress} accessibilityLabel={book.title} style={styles.card}>
      <View style={styles.row}>
        {book.coverUrl ? (
          <Image source={{ uri: book.coverUrl }} style={styles.cover} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.cover, styles.coverFallback, { backgroundColor: coverTone(book.title) }]}>
            <Text style={styles.initial}>{book.title.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.info}>
          <View style={styles.badges}>
            {isWattpad ? <Pill label="Wattpad" bg={colors.wattpadPale} fg={colors.wattpad} /> : null}
            {isStudy ? <Pill label="🎓 Études" bg={colors.studyPale} fg={colors.study} /> : null}
            <Pill
              label={t(`status.${book.status}`)}
              bg={book.status === 'termine' ? colors.greenPale : colors.rule}
              fg={book.status === 'termine' ? colors.green : colors.inkSoft}
              style={styles.badgeSpacing}
            />
          </View>

          <Text variant="sectionTitle" numberOfLines={2} style={styles.title}>
            {book.title}
          </Text>
          <Text variant="small" numberOfLines={1}>
            {book.author}
          </Text>

          <View style={styles.metaRow}>
            {book.rating > 0 ? <StarRating value={book.rating} size={14} /> : null}
            <Text variant="small" style={styles.quoteCount}>
              {t('count.quote', { count: quoteCount })}
            </Text>
          </View>

          {isStudy && book.examDate ? (
            <Text variant="small" color={colors.study} style={styles.exam}>
              Examen dans {t('count.day', { count: daysUntil(book.examDate) })} · fiche{' '}
              {percent(book.studySheet.filter((s) => s.done).length, book.studySheet.length)} %
            </Text>
          ) : null}
        </View>
      </View>

      {book.status === 'en-cours' && book.totalUnits ? (
        <View style={styles.progress}>
          <ProgressBar value={book.progressUnits} total={book.totalUnits} color={accent} />
          <Text variant="small" style={styles.progressText}>
            {unitLabel} {book.progressUnits} / {book.totalUnits} ·{' '}
            {percent(book.progressUnits, book.totalUnits)} %
          </Text>
        </View>
      ) : null}

      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  row: { flexDirection: 'row' },
  cover: { width: 62, height: 92, borderRadius: radii.sm, marginRight: spacing.md },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 30, color: colors.white },
  info: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: spacing.xs, gap: 4 },
  badgeSpacing: {},
  title: { marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  quoteCount: {},
  exam: { marginTop: spacing.xs },
  progress: { marginTop: spacing.md },
  progressText: { marginTop: spacing.xs },
});
