import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

type ClubBook = {
  cb_id: string; title: string; author?: string; cover?: string; book_of_month?: boolean;
  readers_count: number; avg_rating: number; ratings_count: number;
  posts_count: number; collective_pct: number; is_joined: boolean; my_pct: number; my_status?: string | null;
};

type Post = { post_id: string; text: string; spoiler?: boolean; created_at: string; author: { pseudo: string }; book_title?: string; likes_count: number };

export function ClubHome({ clubs, onOpenCircle, onCreateCircle, onJoinCircle }: {
  clubs: any[];
  onOpenCircle: (id: string) => void;
  onCreateCircle: () => void;
  onJoinCircle: () => void;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [books, setBooks] = useState<ClubBook[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pollModal, setPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('Quel sera notre prochain livre ?');
  const [pollSel, setPollSel] = useState<Set<string>>(new Set());
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [sort, setSort] = useState<'tous' | 'populaires' | 'nouveaux' | 'notes'>('tous');
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try {
        const r = await api<{ books: ClubBook[]; active_posts: Post[]; is_admin: boolean }>('/club/home');
        setBooks(r.books); setPosts(r.active_posts); setIsAdmin(r.is_admin);
      } catch {}
      try {
        const p = await api<{ polls: any[] }>('/club/polls');
        setPolls(p.polls);
      } catch {}
      setLoaded(true);
    })();
  }, []));

  const vote = async (pollId: string, option: number) => {
    try {
      const p = await api<any>(`/club/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ option }) });
      setPolls(prev => prev.map(x => x.poll_id === pollId ? p : x));
    } catch {}
  };

  const createPoll = async () => {
    const options = books.filter(b => pollSel.has(b.cb_id)).map(b => ({ title: b.title, author: b.author, cover: b.cover, cb_id: b.cb_id }));
    if (options.length < 2 || !pollQuestion.trim()) return;
    setCreatingPoll(true);
    try {
      const p = await api<any>('/club/polls', { method: 'POST', body: JSON.stringify({ question: pollQuestion.trim(), options, days: 7 }) });
      setPolls(prev => [p, ...prev]);
      setPollModal(false); setPollSel(new Set());
    } finally { setCreatingPoll(false); }
  };

  const shown = useMemo(() => {
    const arr = [...books];
    if (sort === 'populaires') arr.sort((a, b) => (b.readers_count * 2 + b.posts_count) - (a.readers_count * 2 + a.posts_count));
    else if (sort === 'notes') arr.sort((a, b) => b.avg_rating - a.avg_rating || b.ratings_count - a.ratings_count);
    // 'nouveaux' et 'tous' : ordre du serveur (plus récents d'abord)
    const res = sort === 'nouveaux' ? arr.slice(0, 5) : arr;
    // Le livre du mois toujours en tête
    return [...res.filter(b => b.book_of_month), ...res.filter(b => !b.book_of_month)];
  }, [books, sort]);

  const SORTS: [typeof sort, string][] = [['tous', 'Tous'], ['populaires', 'Populaires'], ['nouveaux', 'Nouveautés'], ['notes', 'Mieux notés']];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }} testID="club-home">
      <Pressable testID="club-propose-book" onPress={() => router.push('/club/add')} style={styles.searchFake}>
        <Feather name="search" size={16} color={colors.clay} />
        <Text style={styles.searchFakeText}>{t('Rechercher un livre à proposer au Club…')}</Text>
        <Feather name="plus-circle" size={18} color={colors.chambray} />
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
        {SORTS.map(([s, label]) => (
          <Pressable key={s} testID={`club-sort-${s}`} onPress={() => setSort(s)} style={[styles.chip, sort === s && styles.chipActive]}>
            <Text style={[styles.chipText, sort === s && styles.chipTextActive]}>{t(label)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {polls.map(p => {
        const ends = p.ends_at ? new Date(p.ends_at) : null;
        return (
          <View key={p.poll_id} style={styles.pollCard} testID={`poll-${p.poll_id}`}>
            <Text style={styles.pollLabel}>{p.closed ? t('SONDAGE TERMINÉ') : t('SONDAGE DU CLUB')}</Text>
            <Text style={styles.pollQuestion}>{p.question}</Text>
            {p.options.map((o: any, i: number) => {
              const isMine = p.my_vote === i;
              const isWinner = p.closed && p.winner === i;
              const showResults = p.my_vote != null || p.closed;
              return (
                <Pressable
                  key={i}
                  testID={`poll-option-${i}`}
                  disabled={p.my_vote != null || p.closed}
                  onPress={() => vote(p.poll_id, i)}
                  style={[styles.pollOption, (isMine || isWinner) && { borderColor: colors.chambray }]}
                >
                  {showResults && <View style={[styles.pollFill, { width: `${o.pct}%` }]} />}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {(isMine || isWinner) && <Feather name={isWinner ? 'award' : 'check'} size={13} color={colors.chambray} />}
                    <Text style={styles.pollOptionText} numberOfLines={1}>{o.title}{o.author ? ` — ${o.author}` : ''}</Text>
                  </View>
                  {showResults && <Text style={styles.pollPct}>{o.pct}%</Text>}
                </Pressable>
              );
            })}
            <Text style={styles.pollMeta}>
              {t(p.total_votes > 1 ? '{n} votes' : '{n} vote', { n: p.total_votes })}
              {!p.closed && ends ? ` · ${t('se termine le {date}', { date: ends.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) })}` : ''}
              {p.closed && p.winner != null ? ` · ${t('Élu livre du mois : {title}', { title: p.options[p.winner].title })}` : ''}
            </Text>
          </View>
        );
      })}

      {isAdmin && (
        <Pressable testID="btn-create-poll" onPress={() => setPollModal(true)} style={styles.createPollBtn}>
          <Feather name="bar-chart-2" size={15} color={colors.chambray} />
          <Text style={styles.createPollText}>{t('Créer un sondage')}</Text>
        </Pressable>
      )}

      <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md, gap: spacing.sm }}>
        {!loaded ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ManentLoader size={56} />
          </View>
        ) : loaded && books.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{t('Le Club attend son premier livre.')}</Text>
            <Text style={styles.emptySub}>{t('Propose une lecture, la communauté te suivra.')}</Text>
          </View>
        ) : shown.map(b => (
          <Pressable key={b.cb_id} testID={`club-book-${b.cb_id}`} onPress={() => router.push({ pathname: '/club/book/[id]', params: { id: b.cb_id } })} style={styles.bookCard}>
            <BookCover uri={b.cover} title={b.title} width={56} height={80} initialSize={24} />
            <View style={{ flex: 1 }}>
              {b.book_of_month && <Text style={styles.bomBadge}>{t('LIVRE DU MOIS')}</Text>}
              <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
              {!!b.author && <Text style={styles.bookAuthor} numberOfLines={1}>{b.author}</Text>}
              <View style={styles.metaRow}>
                <Feather name="users" size={11} color={colors.clay} />
                <Text style={styles.meta}>{b.readers_count}</Text>
                {b.avg_rating > 0 && (<><Text style={styles.metaDot}>·</Text><Feather name="star" size={11} color={colors.chambray} /><Text style={styles.meta}>{b.avg_rating}</Text></>)}
                <Text style={styles.metaDot}>·</Text>
                <Feather name="message-circle" size={11} color={colors.clay} />
                <Text style={styles.meta}>{b.posts_count}</Text>
                {b.is_joined && (<><Text style={styles.metaDot}>·</Text><Text style={[styles.meta, { color: colors.chambray }]}>{b.my_status === 'finished' ? t('TERMINÉ') : t('EN LECTURE')}</Text></>)}
              </View>
              {b.readers_count > 0 && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${b.collective_pct}%` }]} />
                </View>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>
        ))}
      </View>

      {posts.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={styles.sectionLabel}>{t('Discussions actives')}</Text>
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
            {posts.map(p => (
              <Pressable key={p.post_id} testID={`club-active-post-${p.post_id}`} onPress={() => router.push({ pathname: '/club/book/[id]', params: { id: (p as any).cb_id, tab: 'posts' } })} style={styles.postCard}>
                <Text style={styles.postMeta}>{p.author?.pseudo} · {p.book_title}</Text>
                <Text style={styles.postText} numberOfLines={2}>{p.spoiler ? t('⚠ Spoiler masqué — ouvre la discussion pour révéler.') : p.text}</Text>
                <View style={styles.metaRow}><Feather name="heart" size={11} color={colors.clay} /><Text style={styles.meta}>{p.likes_count}</Text></View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ marginTop: spacing.xl }}>
        <Text style={styles.sectionLabel}>{t('Tes cercles privés')}</Text>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
          {clubs.map((item: any) => (
            <Pressable key={item.club_id} testID={`club-${item.club_id}`} onPress={() => onOpenCircle(item.club_id)} style={styles.circleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.circleName}>{item.name}</Text>
                <Text style={styles.circleMeta}>{item.members_count} {t(item.members_count > 1 ? 'MEMBRES' : 'MEMBRE')} · {item.messages_count} {t(item.messages_count > 1 ? 'MESSAGES' : 'MESSAGE')}{item.is_owner ? ` · ${t('TON CERCLE')}` : ''}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.clay} />
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable testID="btn-new-club" onPress={onCreateCircle} style={[styles.circleAction, { flex: 1 }]}>
              <Feather name="plus" size={16} color={colors.chambray} />
              <Text style={styles.circleActionText}>{t('Créer un cercle')}</Text>
            </Pressable>
            <Pressable testID="btn-join-club" onPress={onJoinCircle} style={[styles.circleAction, { flex: 1 }]}>
              <Feather name="key" size={15} color={colors.chambray} />
              <Text style={styles.circleActionText}>{t('Rejoindre')}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Modal visible={pollModal} transparent animationType="slide" onRequestClose={() => setPollModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.pollQuestion}>{t('Nouveau sondage')}</Text>
            <TextInput
              testID="poll-question-input"
              value={pollQuestion} onChangeText={setPollQuestion}
              placeholder={t('Ta question…')} placeholderTextColor={colors.clay}
              style={styles.pollInput}
            />
            <Text style={styles.pollMeta}>{t('Choisis 2 à 6 livres du Club :')}</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {books.map(b => {
                const sel = pollSel.has(b.cb_id);
                return (
                  <Pressable key={b.cb_id} testID={`poll-pick-${b.cb_id}`} onPress={() => setPollSel(prev => { const n = new Set(prev); if (n.has(b.cb_id)) n.delete(b.cb_id); else if (n.size < 6) n.add(b.cb_id); return n; })} style={styles.pickRow}>
                    <Feather name={sel ? 'check-square' : 'square'} size={17} color={colors.chambray} />
                    <Text style={styles.pollOptionText} numberOfLines={1}>{b.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              testID="poll-create-confirm"
              onPress={createPoll}
              disabled={pollSel.size < 2 || !pollQuestion.trim() || creatingPoll}
              style={[styles.pollSubmit, (pollSel.size < 2 || !pollQuestion.trim() || creatingPoll) && { opacity: 0.5 }]}
            >
              <Text style={styles.pollSubmitText}>{t('Lancer le sondage (7 jours)')}</Text>
            </Pressable>
            <Pressable onPress={() => setPollModal(false)} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text style={styles.cancelText}>{t('Annuler')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  searchFake: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.md, marginHorizontal: spacing.xl, backgroundColor: colors.creme, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft },
  searchFakeText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.clay },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textAlign: 'center', marginTop: 4 },
  bookCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  bookTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  bookAuthor: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 0.5 },
  metaDot: { color: colors.clay, fontSize: 10 },
  progressBar: { height: 3, backgroundColor: colors.borderSoft, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: 3, backgroundColor: colors.chambray },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  postCard: { backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md },
  postMeta: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 0.8, textTransform: 'uppercase' },
  postText: { fontFamily: fonts.display, fontSize: 15, color: colors.espresso, marginTop: 4, lineHeight: 21 },
  circleCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  circleName: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  circleMeta: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1, marginTop: 3 },
  circleAction: { height: 44, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.creme },
  circleActionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
  bomBadge: { fontFamily: fonts.bodyMedium, fontSize: 8.5, color: colors.chambray, letterSpacing: 1.5 },
  pollCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.creme, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  pollLabel: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.chambray, letterSpacing: 1.5 },
  pollQuestion: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.espresso, marginTop: 2, marginBottom: spacing.sm },
  pollOption: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: spacing.md, marginBottom: 6, overflow: 'hidden' },
  pollFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.glacier },
  pollOptionText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, flexShrink: 1 },
  pollPct: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.chambray },
  pollMeta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
  createPollBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, marginHorizontal: spacing.xl, marginTop: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, backgroundColor: colors.creme },
  createPollText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.glacier, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing.xxl },
  pollInput: { height: 48, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, backgroundColor: colors.creme, marginBottom: spacing.sm },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  pollSubmit: { height: 48, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  pollSubmitText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  cancelText: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textDecorationLine: 'underline' },
});
