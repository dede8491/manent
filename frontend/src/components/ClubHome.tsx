import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { timeAgo, dateFr } from '@/src/timeago';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { useT, useLang } from '@/src/i18n';

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
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [premium, setPremium] = useState<boolean | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [gami, setGami] = useState<any>(null);
  const [eventModal, setEventModal] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState<'discussion' | 'visio' | 'rencontre' | 'rencontre_auteur' | 'audio' | 'challenge'>('discussion');
  const [evDate, setEvDate] = useState('');
  const [evLoc, setEvLoc] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);
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
  const [pubClubs, setPubClubs] = useState<any[]>([]);

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try {
        const st = await api<{ is_premium: boolean }>('/premium/status');
        setPremium(st.is_premium);
        if (!st.is_premium) { setLoaded(true); return; }
      } catch { setPremium(true); }
      try {
        const r = await api<{ books: ClubBook[]; active_posts: Post[]; is_admin: boolean }>('/club/home');
        setBooks(r.books); setPosts(r.active_posts); setIsAdmin(r.is_admin);
      } catch {}
      try {
        const p = await api<{ polls: any[] }>('/club/polls');
        setPolls(p.polls);
      } catch {}
      try {
        const e = await api<{ events: any[] }>('/club/events');
        setEvents(e.events);
      } catch {}
      try {
        setGami(await api<any>('/club/gamification'));
      } catch {}
      try {
        const pc = await api<{ clubs: any[] }>('/clubs/discover');
        setPubClubs(pc.clubs);
      } catch {}
      setLoaded(true);
    })();
  }, []));

  const toggleEvent = async (ev: any) => {
    try {
      const r = await api<{ i_participate: boolean }>(`/club/events/${ev.event_id}/${ev.i_participate ? 'leave' : 'join'}`, { method: 'POST' });
      setEvents(prev => prev.map(x => x.event_id === ev.event_id
        ? { ...x, i_participate: r.i_participate, participants_count: x.participants_count + (r.i_participate ? 1 : -1) }
        : x));
    } catch {}
  };

  const evDateIso = React.useMemo(() => {
    const m = evDate.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?$/);
    if (!m) return null;
    const [, d, mo, y, h, mi] = m;
    const dt = new Date(`${y}-${mo}-${d}T${(h || '18').padStart(2, '0')}:${mi || '00'}:00`);
    return isNaN(dt.getTime()) || dt < new Date() ? null : dt.toISOString();
  }, [evDate]);

  const createEvent = async () => {
    if (!evTitle.trim() || !evDateIso) return;
    setCreatingEvent(true);
    try {
      const e = await api<any>('/club/events', { method: 'POST', body: JSON.stringify({ title: evTitle.trim(), type: evType, date: evDateIso, location: evLoc.trim() || undefined }) });
      setEvents(prev => [...prev, e].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setEventModal(false); setEvTitle(''); setEvDate(''); setEvLoc('');
    } finally { setCreatingEvent(false); }
  };

  const joinPublic = async (cid: string) => {
    try {
      await api(`/clubs/${cid}/join`, { method: 'POST' });
      setPubClubs(prev => prev.filter(c => c.club_id !== cid));
      onOpenCircle(cid);
    } catch {}
  };

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

  const EVENT_TYPES: [typeof evType, string][] = [['discussion', 'Discussion de livre'], ['rencontre_auteur', 'Rencontre avec un auteur'], ['visio', 'Visioconférence'], ['rencontre', 'Rencontre physique'], ['audio', 'Discussion audio'], ['challenge', 'Challenge']];
  const typeLabel = (ty: string) => (EVENT_TYPES.find(([k]) => k === ty)?.[1]) || ty;

  if (premium === false) {
    return (
      <View style={styles.paywall} testID="club-paywall">
        <View style={styles.paywallIcon}><Feather name="lock" size={22} color={colors.chambray} /></View>
        <Text style={styles.paywallTitle}>{t('Le Club de lecture est réservé aux membres Premium.')}</Text>
        <Text style={styles.paywallSub}>{t('Lectures communes, discussions, sondages, événements et challenges — rejoins la communauté.')}</Text>
        <Pressable testID="club-paywall-cta" onPress={() => router.push('/premium')} style={styles.paywallBtn}>
          <Text style={styles.paywallBtnText}>{t('Découvrir Premium')}</Text>
        </Pressable>
      </View>
    );
  }

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

      {gami && (
        <View style={styles.gamiCard} testID="club-gami">
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={styles.pollLabel}>{t('CHALLENGE {year}', { year: gami.challenge.year })}</Text>
            <Text style={styles.gamiPoints}>{gami.me.points} {t('pts')}{gami.me.rank ? ` · ${gami.me.rank}ᵉ` : ''}</Text>
          </View>
          <Text style={styles.gamiTitle}>{t('Lire 12 livres en 12 mois')}</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.min(100, Math.round(gami.challenge.progress / gami.challenge.goal * 100))}%` }]} /></View>
          <Text style={styles.gamiMeta}>{gami.challenge.progress} / {gami.challenge.goal}</Text>
          {gami.me.badges.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
              {gami.me.badges.map((b: any) => (
                <View key={b.id} style={styles.badgeChip}><Feather name="award" size={10} color={colors.chambray} /><Text style={styles.badgeChipText}>{t(b.label)}</Text></View>
              ))}
            </View>
          )}
          {gami.leaderboard.length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              {gami.leaderboard.slice(0, 3).map((u: any, i: number) => (
                <View key={i} style={styles.leaderRow}>
                  <Text style={styles.leaderRank}>{i + 1}{i === 0 ? 'ᵉʳ' : 'ᵉ'}</Text>
                  <Text style={styles.leaderName} numberOfLines={1}>{u.pseudo}</Text>
                  <Text style={styles.gamiMeta}>{u.points} {t('pts')}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {(events.length > 0 || isAdmin) && (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={styles.sectionLabel}>{t('Prochains événements')}</Text>
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
            {events.map(ev => (
              <View key={ev.event_id} style={styles.eventCard} testID={`event-${ev.event_id}`}>
                <Text style={styles.pollLabel}>{t(typeLabel(ev.type)).toUpperCase()} · {dateFr(ev.date, lang)}</Text>
                <Text style={styles.eventTitle}>{ev.title}</Text>
                {!!ev.location && <Text style={styles.gamiMeta}>{ev.location}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <Text style={styles.gamiMeta}>{t(ev.participants_count > 1 ? '{n} participants' : '{n} participant', { n: ev.participants_count })}</Text>
                  <Pressable testID={`event-join-${ev.event_id}`} onPress={() => toggleEvent(ev)} style={[styles.joinEvBtn, ev.i_participate && styles.joinEvBtnActive]}>
                    <Feather name={ev.i_participate ? 'check' : 'calendar'} size={13} color={ev.i_participate ? colors.espresso : colors.creme} />
                    <Text style={[styles.joinEvText, ev.i_participate && { color: colors.espresso }]}>{ev.i_participate ? t('J’y participe') : t('Je participe')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {isAdmin && (
              <Pressable testID="btn-create-event" onPress={() => setEventModal(true)} style={styles.createPollBtn2}>
                <Feather name="calendar" size={15} color={colors.chambray} />
                <Text style={styles.createPollText}>{t('Créer un événement')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {posts.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={styles.sectionLabel}>{t('Discussions actives')}</Text>
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
            {posts.map(p => (
              <Pressable key={p.post_id} testID={`club-active-post-${p.post_id}`} onPress={() => router.push({ pathname: '/club/book/[id]', params: { id: (p as any).cb_id, tab: 'posts' } })} style={styles.postCard}>
                <Text style={styles.postMeta}>{p.author?.pseudo} · {p.book_title} · {timeAgo(p.created_at, lang)}</Text>
                <Text style={styles.postText} numberOfLines={2}>{p.spoiler ? t('⚠ Spoiler masqué — ouvre la discussion pour révéler.') : p.text}</Text>
                <View style={styles.metaRow}><Feather name="heart" size={11} color={colors.clay} /><Text style={styles.meta}>{p.likes_count}</Text></View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ marginTop: spacing.xl }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { paddingHorizontal: 0, marginBottom: 0 }]}>{t('Tes cercles')}</Text>
          <InfoTooltip
            testID="info-circles"
            title={t('Cercles de lecture')}
            text={t("Un cercle est ton mini club de lecture, avec ses lectures communes, ses messages et ses défis. Fermé (cadenas), il ne s'ouvre qu'avec son code d'invitation — parfait entre amis ou en famille. Public (globe), il apparaît dans « Cercles publics à rejoindre » et toute la communauté peut y entrer librement. Avec ton abonnement, tu peux en créer autant que tu veux.")}
          />
        </View>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
          {clubs.map((item: any) => (
            <Pressable key={item.club_id} testID={`club-${item.club_id}`} onPress={() => onOpenCircle(item.club_id)} style={styles.circleCard}>
              <View style={styles.circleAvatar}>
                <Feather name={item.visibility === 'public' ? 'globe' : 'lock'} size={15} color={colors.chambray} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.circleName} numberOfLines={1}>{item.name}</Text>
                  {item.is_owner && <Text style={styles.ownerBadge}>{t('TON CERCLE')}</Text>}
                </View>
                <Text style={styles.circleMeta}>
                  {item.visibility === 'public' ? t('PUBLIC') : t('FERMÉ')} · {item.members_count} {t(item.members_count > 1 ? 'MEMBRES' : 'MEMBRE')} · {item.messages_count} {t(item.messages_count > 1 ? 'MESSAGES' : 'MESSAGE')}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.clay} />
            </Pressable>
          ))}
          {clubs.length === 0 && (
            <View style={styles.circleEmpty}>
              <Text style={styles.emptyTitle}>{t('Ton premier cercle t’attend.')}</Text>
              <Text style={styles.emptySub}>{t('Crée-le fermé pour tes proches, ou public pour toute la communauté.')}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable testID="btn-new-club" onPress={onCreateCircle} style={[styles.circleAction, { flex: 1 }]}>
              <Feather name="plus" size={16} color={colors.chambray} />
              <Text style={styles.circleActionText}>{t('Créer un cercle')}</Text>
            </Pressable>
            <Pressable testID="btn-join-club" onPress={onJoinCircle} style={[styles.circleAction, { flex: 1 }]}>
              <Feather name="key" size={15} color={colors.chambray} />
              <Text style={styles.circleActionText}>{t('J’ai un code')}</Text>
            </Pressable>
          </View>
        </View>

        {pubClubs.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.sectionLabel}>{t('Cercles publics à rejoindre')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
              {pubClubs.map((c: any) => (
                <View key={c.club_id} style={styles.pubCard} testID={`pub-club-${c.club_id}`}>
                  <View style={styles.circleAvatar}><Feather name="globe" size={15} color={colors.chambray} /></View>
                  <Text style={styles.pubName} numberOfLines={1}>{c.name}</Text>
                  {!!c.description && <Text style={styles.pubDesc} numberOfLines={2}>{c.description}</Text>}
                  <Text style={styles.circleMeta}>{c.members_count} {t(c.members_count > 1 ? 'MEMBRES' : 'MEMBRE')}</Text>
                  <Pressable testID={`join-pub-${c.club_id}`} onPress={() => joinPublic(c.club_id)} style={styles.pubJoinBtn}>
                    <Text style={styles.pubJoinText}>{t('Rejoindre')}</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <Modal visible={eventModal} transparent animationType="slide" onRequestClose={() => setEventModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.pollQuestion}>{t('Nouvel événement')}</Text>
            <TextInput testID="event-title-input" value={evTitle} onChangeText={setEvTitle} placeholder={t('Titre (ex. Discussion finale — Houris)')} placeholderTextColor={colors.clay} style={styles.pollInput} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: spacing.sm }}>
              {EVENT_TYPES.map(([k, lbl]) => (
                <Pressable key={k} onPress={() => setEvType(k)} style={[styles.chip, evType === k && styles.chipActive]}>
                  <Text style={[styles.chipText, evType === k && styles.chipTextActive]}>{t(lbl)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput testID="event-date-input" value={evDate} onChangeText={setEvDate} placeholder={t('Date : JJ/MM/AAAA 18h30')} placeholderTextColor={colors.clay} style={styles.pollInput} />
            <TextInput testID="event-loc-input" value={evLoc} onChangeText={setEvLoc} placeholder={t('Lieu ou lien (optionnel)')} placeholderTextColor={colors.clay} style={styles.pollInput} />
            <Pressable testID="event-create-confirm" onPress={createEvent} disabled={!evTitle.trim() || !evDateIso || creatingEvent} style={[styles.pollSubmit, (!evTitle.trim() || !evDateIso || creatingEvent) && { opacity: 0.5 }]}>
              <Text style={styles.pollSubmitText}>{t('Créer l’événement')}</Text>
            </Pressable>
            <Pressable onPress={() => setEventModal(false)} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text style={styles.cancelText}>{t('Annuler')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  circleAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glacier, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ownerBadge: { fontFamily: fonts.bodyMedium, fontSize: 8, color: colors.creme, backgroundColor: colors.clay, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  circleEmpty: { alignItems: 'center', paddingVertical: spacing.lg, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderSoft, paddingHorizontal: spacing.md },
  pubCard: { width: 190, backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  pubName: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso, marginTop: 4 },
  pubDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, lineHeight: 17 },
  pubJoinBtn: { marginTop: 8, height: 34, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  pubJoinText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.creme },
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
  paywall: { alignItems: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxl },
  paywallIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  paywallTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center', marginTop: spacing.lg, lineHeight: 28 },
  paywallSub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm },
  paywallBtn: { height: 48, paddingHorizontal: spacing.xxl, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  paywallBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.creme },
  gamiCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.bisque, borderRadius: 16, padding: spacing.md },
  gamiTitle: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.espresso, marginTop: 2, marginBottom: spacing.sm },
  gamiPoints: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso },
  gamiMeta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
  badgeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.creme },
  badgeChipText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.espresso },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  leaderRank: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.chambray, width: 30 },
  leaderName: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  eventCard: { backgroundColor: colors.creme, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  eventTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso, marginTop: 2 },
  joinEvBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.chambray },
  joinEvBtnActive: { backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft },
  joinEvText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.creme },
  createPollBtn2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, backgroundColor: colors.creme },
});
