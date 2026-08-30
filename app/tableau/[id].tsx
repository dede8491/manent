import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import {
  Avatar, Button, Card, EmptyState, Pill, QuoteSheet, Screen, ScreenHeader, Text,
} from '@/components';
import { ME_ID } from '@/data/seed';
import { visibilityLabel } from '@/features/community/BoardsPane';
import { t } from '@/i18n';
import { copyLink, publicBoardUrl } from '@/services/share';
import { useBoardQuotes } from '@/store/selectors';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';

export default function DetailTableau() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const board = useStore((s) => s.boards.find((b) => b.id === id));
  const books = useStore((s) => s.books);
  const removeBoard = useStore((s) => s.removeBoard);
  const pinned = useBoardQuotes(id ?? '');

  if (!board) {
    return (
      <Screen>
        <ScreenHeader title="Tableau" />
        <EmptyState emoji="📌" title="Tableau introuvable" body="Il a peut-être été supprimé." />
      </Screen>
    );
  }

  const invite = () =>
    Alert.alert(
      'Inviter sur ce tableau',
      board.visibility === 'collaboratif'
        ? 'Partage le lien : les personnes invitées pourront épingler leurs citations.'
        : 'Ce tableau n’est pas collaboratif. Passe-le en collaboratif pour que d’autres épinglent.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Copier le lien', onPress: () => copyLink(publicBoardUrl(board.shareSlug)) },
      ],
    );

  const confirmDelete = () =>
    Alert.alert('Supprimer ce tableau ?', 'Les citations épinglées ne sont pas supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          removeBoard(board.id);
          router.replace('/(tabs)/communaute');
        },
      },
    ]);

  return (
    <Screen>
      <ScreenHeader title={board.name} subtitle={board.description} />

      <Card>
        <View style={styles.metaRow}>
          <Pill label={visibilityLabel(board.visibility)} />
          <Text variant="small">{t('count.pin', { count: pinned.length })}</Text>
        </View>

        {board.visibility === 'collaboratif' ? (
          <View style={styles.members}>
            <Text variant="overline" style={styles.membersLabel}>
              MEMBRES
            </Text>
            <View style={styles.avatars}>
              {board.memberIds.map((m) => (
                <Avatar key={m} emoji={m === ME_ID ? '🌿' : '📗'} size={30} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="🔗 Partager"
            variant="secondary"
            full={false}
            small
            onPress={() => copyLink(publicBoardUrl(board.shareSlug), 'Lien du tableau copié')}
          />
          <Button label="+ Inviter" variant="secondary" full={false} small onPress={invite} />
        </View>
        <Text variant="small" style={styles.url}>
          {publicBoardUrl(board.shareSlug)}
        </Text>
      </Card>

      {pinned.length === 0 ? (
        <EmptyState
          emoji="📌"
          title="Rien d'épinglé"
          body="Ouvre une citation puis « Épingler sur un tableau » pour la retrouver ici."
          actionLabel="Capturer une citation"
          onAction={() => router.push('/capture')}
        />
      ) : (
        pinned.map(({ pin, quote }) => {
          const book = books.find((b) => b.id === quote.bookId);
          return (
            <QuoteSheet
              key={pin.id}
              text={quote.text}
              locator={quote.locator}
              bookTitle={book?.title ?? ''}
              bookAuthor={book?.author ?? ''}
              bookKind={book?.kind}
              themes={quote.themes}
              isPrivate={!quote.isPublic}
              byline={{
                pseudo: pin.pinnedBy === ME_ID ? 'toi' : pin.pinnedBy.replace('user_', ''),
                avatarEmoji: pin.pinnedBy === ME_ID ? '🌿' : '📗',
                prefix: 'épinglée par',
              }}
              onPress={() => router.push(`/citation/${quote.id}`)}
            />
          );
        })
      )}

      <Button label="Supprimer le tableau" variant="danger" onPress={confirmDelete} style={styles.delete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  members: { marginTop: spacing.lg },
  membersLabel: { marginBottom: spacing.sm },
  avatars: { flexDirection: 'row', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  url: { marginTop: spacing.md, color: colors.muted },
  delete: { marginTop: spacing.xl },
});
