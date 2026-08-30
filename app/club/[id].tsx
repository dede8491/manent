import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import {
  Avatar, Button, Card, EmptyState, Field, Pill, ProgressBar, QuoteSheet, Screen,
  ScreenHeader, SectionHeader, Text,
} from '@/components';
import { ME_ID } from '@/data/seed';
import { daysUntil, formatDay, formatEvent, ordinal, percent, plural, timeAgo } from '@/lib/format';
import { clubInviteUrl, copyLink } from '@/services/share';
import { useStore } from '@/store/useStore';
import { colors, radii, spacing } from '@/theme';

export default function DetailClub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const club = useStore((s) => s.clubs.find((c) => c.id === id));
  const allPosts = useStore((s) => s.clubPosts);
  const badges = useStore((s) => s.badges);
  const addClubComment = useStore((s) => s.addClubComment);
  const toggleEventAttendance = useStore((s) => s.toggleEventAttendance);
  const leaveClub = useStore((s) => s.leaveClub);
  const joinClub = useStore((s) => s.joinClub);

  const [comment, setComment] = useState('');

  // Les sélecteurs zustand doivent renvoyer une référence stable : on filtre ici.
  const posts = useMemo(() => allPosts.filter((p) => p.clubId === id), [allPosts, id]);

  const ranking = useMemo(() => {
    if (!club) return { mine: null as null | { page: number; rank: number }, ahead: 0 };
    const sorted = [...club.memberProgress].sort((a, b) => b.page - a.page);
    const index = sorted.findIndex((m) => m.userId === ME_ID);
    const half = club.commonRead ? club.commonRead.totalPages / 2 : Infinity;
    return {
      mine: index >= 0 ? { page: sorted[index].page, rank: index + 1 } : null,
      ahead: club.memberProgress.filter((m) => m.page >= half).length,
    };
  }, [club]);

  if (!club) {
    return (
      <Screen>
        <ScreenHeader title="Club" />
        <EmptyState emoji="📖" title="Club introuvable" body="Il a peut-être été fermé." />
      </Screen>
    );
  }

  const commonRead = club.commonRead;
  const medal = ranking.mine?.rank === 1 ? '🥇' : ranking.mine?.rank === 2 ? '🥈' : ranking.mine?.rank === 3 ? '🥉' : '';
  const post = posts[0];
  const rewardBadge = badges.find((b) => b.id === club.challenge?.badgeId);

  return (
    <Screen>
      <ScreenHeader title={club.name} subtitle={club.description} />

      <Card>
        <View style={styles.headRow}>
          <Text variant="small">{plural(club.memberCount, 'membre', 'membres')}</Text>
          {club.role ? (
            <Pill
              label={club.role === 'animatrice' ? 'tu animes ce club' : 'membre'}
              bg={club.role === 'animatrice' ? colors.amberPale : colors.greenPale}
              fg={club.role === 'animatrice' ? colors.amber : colors.green}
            />
          ) : null}
        </View>
        <Text variant="small" color={colors.green} style={styles.themes}>
          {club.themes.map((t) => `#${t}`).join(' ')}
        </Text>
        <Button
          label={club.joined ? 'Quitter le club' : 'Rejoindre'}
          variant={club.joined ? 'ghost' : 'primary'}
          onPress={() =>
            club.joined
              ? Alert.alert('Quitter ce club ?', 'Tu perdras l’accès aux discussions.', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Quitter', style: 'destructive', onPress: () => leaveClub(club.id) },
                ])
              : joinClub(club.id)
          }
        />
      </Card>

      {commonRead ? (
        <>
          <SectionHeader title="Lecture commune du mois" />
          <Card>
            <Text variant="sectionTitle">{commonRead.bookTitle}</Text>
            <Text variant="small">{commonRead.bookAuthor}</Text>
            <Text variant="small" color={colors.amber} style={styles.deadline}>
              Pour le {formatDay(commonRead.deadline)} · dans{' '}
              {plural(daysUntil(commonRead.deadline), 'jour', 'jours')}
            </Text>

            <Text variant="overline" style={styles.blockLabel}>
              PROGRESSION COLLECTIVE
            </Text>
            <ProgressBar
              value={ranking.ahead}
              total={club.memberProgress.length || club.memberCount}
              height={10}
            />
            <Text variant="small" style={styles.collective}>
              {ranking.ahead}/{club.memberProgress.length || club.memberCount} ont dépassé la moitié
            </Text>

            {ranking.mine ? (
              <View style={styles.mine}>
                <Text variant="label">
                  Toi : p. {ranking.mine.page} · {ordinal(ranking.mine.rank)} du club {medal}
                </Text>
                <Text variant="small">
                  {percent(ranking.mine.page, commonRead.totalPages)} % de la lecture commune
                </Text>
              </View>
            ) : null}

            {club.memberProgress.map((m) => (
              <View key={m.userId} style={styles.memberRow}>
                <Avatar emoji={m.avatarEmoji} size={28} />
                <Text variant="small" style={styles.memberName}>
                  {m.userId === ME_ID ? 'toi' : m.pseudo}
                </Text>
                <View style={styles.memberBar}>
                  <ProgressBar value={m.page} total={commonRead.totalPages} height={6} />
                </View>
                <Text variant="small" style={styles.memberPage}>
                  p. {m.page}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {club.events.length > 0 ? (
        <>
          <SectionHeader title="Événement en ligne" />
          {club.events.map((event) => {
            const going = event.attendeeIds.includes(ME_ID);
            return (
              <Card key={event.id}>
                <Text variant="sectionTitle">{event.title}</Text>
                <Text variant="body" style={styles.eventWhen}>
                  {formatEvent(event.startsAt)} — {event.scope}
                </Text>
                <Text variant="small">
                  {plural(event.attendeeIds.length, 'participant', 'participants')}
                </Text>
                <Button
                  label={going ? '✓ Tu y seras' : "J'y serai"}
                  variant={going ? 'secondary' : 'primary'}
                  onPress={() => toggleEventAttendance(club.id, event.id)}
                  style={styles.eventBtn}
                />
                {going ? (
                  <Text variant="small" style={styles.eventHint}>
                    Rappel programmé. Le lien visio t’est envoyé avant le début.
                  </Text>
                ) : null}
                {going && event.visioUrl ? (
                  <Button
                    label="Ouvrir le lien visio"
                    variant="ghost"
                    onPress={() => Linking.openURL(event.visioUrl as string).catch(() => {})}
                  />
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}

      <SectionHeader title="Passage de la semaine" />
      {post ? (
        <>
          <QuoteSheet
            text={post.quoteText}
            locator={post.locator}
            bookTitle={post.bookTitle}
            bookAuthor={post.bookAuthor}
            byline={{ pseudo: post.proposedBy, avatarEmoji: post.proposedByEmoji, prefix: 'proposé par' }}
          />

          <Card>
            <Text variant="overline">
              {plural(post.comments.length, 'COMMENTAIRE', 'COMMENTAIRES')}
            </Text>
            {post.comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <Avatar emoji={c.avatarEmoji} size={32} />
                <View style={styles.commentBody}>
                  <Text variant="label">
                    {c.pseudo}{' '}
                    <Text variant="small" color={colors.muted}>
                      · {timeAgo(c.createdAt)}
                    </Text>
                  </Text>
                  <Text variant="body">{c.text}</Text>
                </View>
              </View>
            ))}

            <View style={styles.commentInput}>
              <Field
                value={comment}
                onChangeText={setComment}
                placeholder="Ce que ce passage t'évoque…"
                multiline
              />
              <Button
                label="Commenter"
                disabled={comment.trim().length < 2}
                onPress={() => {
                  addClubComment(post.id, comment);
                  setComment('');
                }}
              />
            </View>
          </Card>
        </>
      ) : (
        <EmptyState
          emoji="💬"
          title="Aucun passage proposé"
          body="Propose une citation à discuter cette semaine, elle ouvrira le fil de commentaires."
          actionLabel="Capturer une citation"
          onAction={() => router.push('/capture')}
        />
      )}

      {club.challenge ? (
        <>
          <SectionHeader title="Challenge du club" />
          <Card>
            <Text variant="sectionTitle">{club.challenge.title}</Text>
            <View style={styles.challengeBar}>
              <ProgressBar value={club.challenge.progress} total={club.challenge.goal} color={colors.amber} />
            </View>
            <Text variant="small">
              {club.challenge.progress} / {club.challenge.goal} {club.challenge.unit}
            </Text>
            {rewardBadge ? (
              <View style={styles.reward}>
                <Text style={styles.rewardEmoji}>{rewardBadge.emoji}</Text>
                <View style={styles.rewardText}>
                  <Text variant="label">Badge à débloquer : {rewardBadge.label}</Text>
                  <Text variant="small">{rewardBadge.description}</Text>
                </View>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Inviter" />
      <Card>
        <Text variant="body">Partage ce lien pour inviter quelqu’un dans le club.</Text>
        <Text variant="small" style={styles.inviteUrl}>
          {clubInviteUrl(club.inviteSlug)}
        </Text>
        <Button
          label="🔗 Copier le lien d'invitation"
          variant="secondary"
          onPress={() => copyLink(clubInviteUrl(club.inviteSlug), "Lien d'invitation copié")}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  themes: { marginTop: spacing.xs, marginBottom: spacing.lg },
  deadline: { marginTop: spacing.sm },
  blockLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  collective: { marginTop: spacing.sm },
  mine: {
    marginTop: spacing.md,
    backgroundColor: colors.greenPale,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  memberName: { width: 62, marginLeft: spacing.sm },
  memberBar: { flex: 1, marginHorizontal: spacing.sm },
  memberPage: { width: 46, textAlign: 'right' },
  eventWhen: { marginTop: spacing.xs },
  eventBtn: { marginTop: spacing.md },
  eventHint: { marginTop: spacing.sm },
  comment: { flexDirection: 'row', marginTop: spacing.md },
  commentBody: { flex: 1, marginLeft: spacing.md },
  commentInput: { marginTop: spacing.lg },
  challengeBar: { marginTop: spacing.md, marginBottom: spacing.sm },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.amberPale,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  rewardEmoji: { fontSize: 26, marginRight: spacing.md },
  rewardText: { flex: 1 },
  inviteUrl: { marginTop: spacing.sm, marginBottom: spacing.lg, color: colors.muted },
});
