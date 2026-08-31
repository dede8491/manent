import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { useT } from '@/src/i18n';

const CRITERIA: [string, string][] = [['histoire', 'Histoire'], ['ecriture', 'Écriture'], ['personnages', 'Personnages'], ['emotion', 'Émotion']];

function Stars({ value, size = 14, onSet, testID }: { value: number; size?: number; onSet?: (n: number) => void; testID?: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} testID={testID}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} disabled={!onSet} onPress={() => onSet?.(n)} hitSlop={4}>
          <Ionicons name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? colors.chambray : colors.bisque} />
        </Pressable>
      ))}
    </View>
  );
}

export default function ClubBookDetail() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [book, setBook] = useState<any>(null);
  const [tab, setTab] = useState<'apropos' | 'lecteurs' | 'posts' | 'avis'>(tabParam === 'posts' ? 'posts' : 'apropos');
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any>({ reviews: [], mine: null, avg_criteria: {} });
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [postText, setPostText] = useState('');
  const [postSpoiler, setPostSpoiler] = useState(false);
  const [spoilerChapter, setSpoilerChapter] = useState('');
  const [progressModal, setProgressModal] = useState(false);
  const [pctInput, setPctInput] = useState('');
  const [myCrit, setMyCrit] = useState<Record<string, number>>({});
  const [reviewText, setReviewText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await api<any>(`/club/books/${id}`);
      setBook(b);
      const p = await api<{ posts: any[] }>(`/club/books/${id}/posts`);
      setPosts(p.posts);
      const r = await api<any>(`/club/books/${id}/reviews`);
      setReviews(r);
      if (r.mine) { setMyCrit(r.mine.criteria || {}); setReviewText(r.mine.text || ''); }
    } catch {}
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleJoin = async () => {
    if (!book) return;
    setBusy('join');
    try {
      await api(`/club/books/${id}/${book.is_joined ? 'leave' : 'join'}`, { method: 'POST' });
      await load();
    } finally { setBusy(null); }
  };

  const saveProgress = async (finished = false) => {
    setBusy('progress');
    try {
      const body = finished ? { finished: true } : { pct: Math.max(0, Math.min(100, parseInt(pctInput, 10) || 0)) };
      await api(`/club/books/${id}/progress`, { method: 'PATCH', body: JSON.stringify(body) });
      setProgressModal(false);
      await load();
    } finally { setBusy(null); }
  };

  const publishPost = async () => {
    if (!postText.trim()) return;
    setBusy('post');
    try {
      await api(`/club/books/${id}/posts`, { method: 'POST', body: JSON.stringify({ text: postText.trim(), spoiler: postSpoiler, spoiler_chapter: postSpoiler ? spoilerChapter : undefined }) });
      setPostText(''); setPostSpoiler(false); setSpoilerChapter('');
      const p = await api<{ posts: any[] }>(`/club/books/${id}/posts`);
      setPosts(p.posts);
    } finally { setBusy(null); }
  };

  const toggleLike = async (postId: string) => {
    try {
      const r = await api<{ liked: boolean; likes_count: number }>(`/club/posts/${postId}/like`, { method: 'POST' });
      setPosts(prev => prev.map(p => p.post_id === postId ? { ...p, liked_by_me: r.liked, likes_count: r.likes_count } : p));
    } catch {}
  };

  const openComments = async (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId); setCommentInput('');
    try {
      const r = await api<{ comments: any[] }>(`/club/posts/${postId}/comments`);
      setComments(prev => ({ ...prev, [postId]: r.comments }));
    } catch {}
  };

  const sendComment = async (postId: string) => {
    if (!commentInput.trim()) return;
    setBusy('comment');
    try {
      const c = await api<any>(`/club/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text: commentInput.trim() }) });
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), c] }));
      setPosts(prev => prev.map(p => p.post_id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      setCommentInput('');
    } finally { setBusy(null); }
  };

  const report = (kind: string, targetId: string) => {
    const doReport = async () => {
      try { await api('/club/report', { method: 'POST', body: JSON.stringify({ kind, target_id: targetId }) }); } catch {}
    };
    if (Platform.OS === 'web') { doReport(); alert(t('Merci, le contenu a été signalé.')); }
    else Alert.alert(t('Signaler ce contenu ?'), t('Un modérateur y jettera un œil.'), [
      { text: t('Annuler'), style: 'cancel' },
      { text: t('Signaler'), style: 'destructive', onPress: doReport },
    ]);
  };

  const saveReview = async () => {
    if (Object.keys(myCrit).length === 0) return;
    setBusy('review');
    try {
      await api(`/club/books/${id}/reviews`, { method: 'POST', body: JSON.stringify({ criteria: myCrit, text: reviewText }) });
      const r = await api<any>(`/club/books/${id}/reviews`);
      setReviews(r);
      await load();
    } finally { setBusy(null); }
  };

  const removeBook = () => {
    const doRemove = async () => {
      try { await api(`/club/books/${id}`, { method: 'DELETE' }); router.back(); } catch {}
    };
    if (Platform.OS === 'web') doRemove();
    else Alert.alert(t('Retirer ce livre du Club ?'), t('Les discussions et avis associés seront supprimés.'), [
      { text: t('Annuler'), style: 'cancel' },
      { text: t('Retirer'), style: 'destructive', onPress: doRemove },
    ]);
  };

  if (!book) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center' }}>
        <ManentLoader size={56} />
      </View>
    );
  }

  const TABS: [typeof tab, string][] = [['apropos', 'À propos'], ['lecteurs', 'Lecteurs'], ['posts', 'Discussions'], ['avis', 'Avis']];

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-club-book">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="club-book-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Club de lecture')}</Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <BookCover uri={book.cover} title={book.title} width={84} height={120} initialSize={34} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{book.title}</Text>
            {!!book.author && <Text style={styles.author}>{book.author}</Text>}
            <Text style={styles.metaLine}>{[book.year, book.pages ? `${book.pages} p.` : null].filter(Boolean).join('  ·  ')}</Text>
            <View style={styles.statChips}>
              <View style={styles.statChip}><Feather name="users" size={11} color={colors.clay} /><Text style={styles.statChipText}>{book.readers_count}</Text></View>
              <View style={styles.statChip}><Feather name="star" size={11} color={colors.chambray} /><Text style={styles.statChipText}>{book.avg_rating || '—'}</Text></View>
              <View style={styles.statChip}><Feather name="message-circle" size={11} color={colors.clay} /><Text style={styles.statChipText}>{book.posts_count}</Text></View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
          <Pressable testID="club-book-join" onPress={toggleJoin} disabled={busy === 'join'} style={[styles.joinBtn, book.is_joined && styles.joinedBtn]}>
            <Feather name={book.is_joined ? 'check' : 'book-open'} size={15} color={book.is_joined ? colors.espresso : colors.creme} />
            <Text style={[styles.joinText, book.is_joined && { color: colors.espresso }]}>
              {book.is_joined ? t('Je participe — quitter la lecture') : t('Rejoindre la lecture')}
            </Text>
          </Pressable>
          {book.is_joined && (
            <View style={styles.myProgress} testID="club-my-progress">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={styles.myProgressLabel}>{book.my_status === 'finished' ? t('Lecture terminée') : t('Ma progression : {pct}%', { pct: book.my_pct })}</Text>
                <Pressable testID="club-progress-edit" onPress={() => { setPctInput(String(book.my_pct)); setProgressModal(true); }} hitSlop={8}>
                  <Text style={styles.editLink}>{t('Modifier')}</Text>
                </Pressable>
              </View>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${book.my_pct}%` }]} /></View>
            </View>
          )}
        </View>

        <View style={styles.tabRow}>
          {TABS.map(([tb, label]) => (
            <Pressable key={tb} testID={`club-tab-${tb}`} onPress={() => setTab(tb)} style={[styles.tabBtn, tab === tb && styles.tabActive]}>
              <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>{t(label)}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'apropos' && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
            <Text style={styles.body}>{book.summary || t('Pas encore de résumé. La communauté découvre ce livre ensemble — rejoins la lecture et partage tes impressions.')}</Text>
            {!!book.added_by_pseudo && <Text style={styles.note}>{t('Proposé par {pseudo}', { pseudo: book.added_by_pseudo })}</Text>}
            <Text style={styles.note}>{t('Progression collective : {pct}% · {n} lecture(s) terminée(s)', { pct: book.collective_pct, n: book.finished_count })}</Text>
            {book.can_remove && (
              <Pressable testID="club-book-remove" onPress={removeBook} style={styles.removeBtn}>
                <Feather name="trash-2" size={14} color="#B3552F" />
                <Text style={styles.removeText}>{t('Retirer du Club')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {tab === 'lecteurs' && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
            {book.readers.length === 0 ? (
              <Text style={styles.emptySub}>{t('Personne n’a encore rejoint cette lecture. Sois la première !')}</Text>
            ) : book.readers.map((r: any, i: number) => (
              <Pressable key={i} testID={`club-reader-${i}`} onPress={() => r.handle && router.push({ pathname: '/reader/[handle]', params: { handle: r.handle } })} style={styles.readerRow}>
                <View style={styles.avatar}>{r.picture ? <Image source={{ uri: r.picture }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : <Text style={styles.avatarInitial}>{(r.pseudo?.[0] || 'M').toUpperCase()}</Text>}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.readerName}>{r.pseudo}</Text>
                  <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${r.pct}%` }]} /></View>
                </View>
                <Text style={styles.readerPct}>{r.status === 'finished' ? t('Terminé') : `${r.pct}%`}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {tab === 'posts' && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
            <View style={styles.composer}>
              <TextInput
                testID="club-post-input"
                value={postText} onChangeText={setPostText}
                placeholder={t('Lance une discussion : « Que pensez-vous du début ? »')}
                placeholderTextColor={colors.clay}
                style={styles.composerInput}
                multiline
              />
              <Pressable testID="club-post-spoiler" onPress={() => setPostSpoiler(v => !v)} style={styles.spoilerToggle}>
                <Feather name={postSpoiler ? 'check-square' : 'square'} size={16} color={colors.chambray} />
                <Text style={styles.spoilerToggleText}>{t('Contient un spoiler')}</Text>
              </Pressable>
              {postSpoiler && (
                <TextInput
                  testID="club-post-spoiler-chapter"
                  value={spoilerChapter} onChangeText={setSpoilerChapter}
                  placeholder={t('Chapitre concerné (ex. Chapitre 8)')}
                  placeholderTextColor={colors.clay}
                  style={[styles.composerInput, { minHeight: 40, marginTop: 6 }]}
                />
              )}
              <Pressable testID="club-post-send" onPress={publishPost} disabled={!postText.trim() || busy === 'post'} style={[styles.sendBtn, (!postText.trim() || busy === 'post') && { opacity: 0.5 }]}>
                <Text style={styles.sendText}>{t('Publier')}</Text>
              </Pressable>
            </View>
            {posts.length === 0 && <Text style={styles.emptySub}>{t('Aucune discussion pour l’instant. Ouvre le bal !')}</Text>}
            {posts.map(p => {
              const hidden = p.spoiler && !revealed.has(p.post_id);
              return (
                <View key={p.post_id} style={styles.post} testID={`club-post-${p.post_id}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.avatarSm}>{p.author?.picture ? <Image source={{ uri: p.author.picture }} style={{ width: 26, height: 26, borderRadius: 13 }} /> : <Text style={styles.avatarSmText}>{(p.author?.pseudo?.[0] || 'M').toUpperCase()}</Text>}</View>
                    <Text style={styles.postAuthor}>{p.author?.pseudo}</Text>
                    <View style={{ flex: 1 }} />
                    {!p.is_mine && (
                      <Pressable testID={`club-post-report-${p.post_id}`} onPress={() => report('post', p.post_id)} hitSlop={8}>
                        <Feather name="flag" size={13} color={colors.clay} />
                      </Pressable>
                    )}
                  </View>
                  {hidden ? (
                    <Pressable testID={`club-post-reveal-${p.post_id}`} onPress={() => setRevealed(prev => new Set(prev).add(p.post_id))} style={styles.spoilerBox}>
                      <Feather name="alert-triangle" size={14} color={colors.chambray} />
                      <Text style={styles.spoilerBoxText}>
                        {t('Spoiler{ch} — appuie pour révéler', { ch: p.spoiler_chapter ? ` (${p.spoiler_chapter})` : '' })}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.postBody}>{p.text}</Text>
                  )}
                  <View style={styles.postActions}>
                    <Pressable testID={`club-post-like-${p.post_id}`} onPress={() => toggleLike(p.post_id)} style={styles.actionBtn} hitSlop={6}>
                      <Ionicons name={p.liked_by_me ? 'heart' : 'heart-outline'} size={16} color={p.liked_by_me ? colors.chambray : colors.clay} />
                      <Text style={styles.actionText}>{p.likes_count}</Text>
                    </Pressable>
                    <Pressable testID={`club-post-comments-${p.post_id}`} onPress={() => openComments(p.post_id)} style={styles.actionBtn} hitSlop={6}>
                      <Feather name="message-circle" size={15} color={colors.clay} />
                      <Text style={styles.actionText}>{p.comments_count}</Text>
                    </Pressable>
                  </View>
                  {expandedPost === p.post_id && (
                    <View style={styles.commentBlock}>
                      {(comments[p.post_id] || []).map((c: any) => (
                        <View key={c.comment_id} style={styles.comment}>
                          <Text style={styles.commentAuthor}>{c.author?.pseudo}</Text>
                          <Text style={styles.commentText}>{c.text}</Text>
                        </View>
                      ))}
                      <View style={styles.commentRow}>
                        <TextInput
                          testID={`club-comment-input-${p.post_id}`}
                          value={commentInput} onChangeText={setCommentInput}
                          placeholder={t('Répondre…')}
                          placeholderTextColor={colors.clay}
                          style={styles.commentInput}
                        />
                        <Pressable testID={`club-comment-send-${p.post_id}`} onPress={() => sendComment(p.post_id)} disabled={!commentInput.trim()} style={[styles.commentSend, !commentInput.trim() && { opacity: 0.5 }]}>
                          <Feather name="send" size={15} color={colors.creme} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {tab === 'avis' && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
            <View style={styles.reviewForm} testID="club-review-form">
              <Text style={styles.reviewFormTitle}>{reviews.mine ? t('Ton avis') : t('Donne ton avis')}</Text>
              {CRITERIA.map(([key, label]) => (
                <View key={key} style={styles.critRow}>
                  <Text style={styles.critLabel}>{t(label)}</Text>
                  <Stars value={myCrit[key] || 0} size={18} onSet={n => setMyCrit(prev => ({ ...prev, [key]: n }))} testID={`club-crit-${key}`} />
                </View>
              ))}
              <TextInput
                testID="club-review-text"
                value={reviewText} onChangeText={setReviewText}
                placeholder={t('Quelques mots sur ta lecture (optionnel)…')}
                placeholderTextColor={colors.clay}
                style={[styles.composerInput, { marginTop: spacing.sm }]}
                multiline
              />
              <Pressable testID="club-review-save" onPress={saveReview} disabled={Object.keys(myCrit).length === 0 || busy === 'review'} style={[styles.sendBtn, (Object.keys(myCrit).length === 0 || busy === 'review') && { opacity: 0.5 }]}>
                <Text style={styles.sendText}>{reviews.mine ? t('Mettre à jour') : t('Publier mon avis')}</Text>
              </Pressable>
            </View>
            {reviews.reviews.length > 0 && Object.keys(reviews.avg_criteria || {}).length > 0 && (
              <View style={styles.avgBox}>
                <Text style={styles.reviewFormTitle}>{t('Moyennes de la communauté')}</Text>
                {CRITERIA.map(([key, label]) => (
                  <View key={key} style={styles.critRow}>
                    <Text style={styles.critLabel}>{t(label)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Stars value={reviews.avg_criteria[key] || 0} />
                      <Text style={styles.avgNum}>{reviews.avg_criteria[key] || '—'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {reviews.reviews.map((r: any, i: number) => (
              <View key={i} style={styles.reviewCard} testID={`club-review-${i}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.postAuthor}>{r.author?.pseudo}</Text>
                  <View style={{ flex: 1 }} />
                  <Stars value={r.note} />
                  <Text style={styles.avgNum}>{r.note}</Text>
                </View>
                {!!r.text && <Text style={styles.postBody}>{r.text}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={progressModal} transparent animationType="slide" onRequestClose={() => setProgressModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.modalTitle}>{t('Ma progression')}</Text>
            <Text style={styles.note}>{t('Où en es-tu, en pourcentage ?')}</Text>
            <TextInput
              testID="club-progress-input"
              value={pctInput} onChangeText={setPctInput}
              keyboardType="number-pad" maxLength={3}
              placeholder="50" placeholderTextColor={colors.clay}
              style={styles.pctInput}
            />
            <PrimaryButton testID="club-progress-save" title={t('Enregistrer')} onPress={() => saveProgress(false)} loading={busy === 'progress'} />
            <GhostButton testID="club-progress-finish" title={t('Marquer comme terminé')} onPress={() => saveProgress(true)} />
            <GhostButton title={t('Annuler')} onPress={() => setProgressModal(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  hero: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, alignItems: 'center' },
  title: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, lineHeight: 28 },
  author: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, marginTop: 2 },
  metaLine: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 0.8, marginTop: 4 },
  statChips: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: radius.pill, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft },
  statChipText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.espresso },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.md, backgroundColor: colors.chambray },
  joinedBtn: { backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft },
  joinText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  myProgress: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  myProgressLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso },
  editLink: { fontFamily: fonts.body, fontSize: 12, color: colors.chambray, textDecorationLine: 'underline' },
  progressBar: { height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: 4, backgroundColor: colors.chambray },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.xl, marginVertical: spacing.md },
  tabBtn: { flex: 1, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  tabText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.espresso },
  tabTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, lineHeight: 21 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, lineHeight: 17 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: spacing.sm },
  removeText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: '#B3552F' },
  emptySub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, textAlign: 'center', paddingVertical: spacing.md },
  readerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.espresso },
  readerName: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.espresso },
  readerPct: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 0.5 },
  composer: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  composerInput: { minHeight: 60, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, textAlignVertical: 'top', padding: 0 },
  spoilerToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  spoilerToggleText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.espresso },
  sendBtn: { alignSelf: 'flex-end', height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  sendText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  post: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  avatarSm: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  avatarSmText: { fontFamily: fonts.displayMedium, fontSize: 12, color: colors.espresso },
  postAuthor: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  postBody: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, lineHeight: 20, marginTop: spacing.sm },
  spoilerBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.glacier, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, padding: spacing.md, marginTop: spacing.sm },
  spoilerBoxText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray },
  postActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.clay },
  commentBlock: { marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft, paddingTop: spacing.sm, gap: spacing.sm },
  comment: { backgroundColor: colors.glacier, borderRadius: radius.sm, padding: spacing.sm },
  commentAuthor: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.clay },
  commentText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso, marginTop: 2 },
  commentRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  commentInput: { flex: 1, height: 40, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 13, color: colors.espresso, backgroundColor: colors.glacier },
  commentSend: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  reviewForm: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  reviewFormTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso, marginBottom: spacing.sm },
  critRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  critLabel: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso },
  avgBox: { backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md },
  avgNum: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso },
  reviewCard: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.glacier, padding: spacing.xl, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, marginBottom: spacing.xs },
  pctInput: { height: 56, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, backgroundColor: colors.creme, marginVertical: spacing.md, textAlign: 'center' },
});
