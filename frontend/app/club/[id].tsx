import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, Share, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import ManentLoader from '@/src/components/ManentLoader';

export default function ClubDetail() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [club, setClub] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [bookModal, setBookModal] = useState(false);
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [passageModal, setPassageModal] = useState(false);
  const [passageText, setPassageText] = useState('');
  const [passagePage, setPassagePage] = useState('');
  const [challengeModal, setChallengeModal] = useState(false);
  const [chTitle, setChTitle] = useState('');
  const [chGoal, setChGoal] = useState('');
  const [myPages, setMyPages] = useState('');
  const [recoModal, setRecoModal] = useState(false);
  const [recoBook, setRecoBook] = useState<any | null>(null);
  const [recoNote, setRecoNote] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const c = await api<any>(`/clubs/${id}`);
      setClub(c);
      const m = await api<{ messages: any[] }>(`/clubs/${id}/messages`);
      setMessages(m.messages);
    } catch {}
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      const m = await api<any>(`/clubs/${id}/messages`, { method: 'POST', body: JSON.stringify({ text: msg.trim() }) });
      setMessages(prev => [...prev, m]);
      setMsg('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } finally { setSending(false); }
  };

  const shareCode = async () => {
    const message = t('Rejoins mon club de lecture « {name} » sur Manent avec le code {code}', { name: club.name, code: club.code });
    try {
      if (Platform.OS === 'web') {
        const nav: any = navigator;
        if (nav.share) await nav.share({ text: message });
        else if (nav.clipboard) await nav.clipboard.writeText(message);
      } else {
        await Share.share({ message });
      }
    } catch {}
  };

  const openBookPicker = async () => {
    const r = await api<{ books: any[] }>('/books');
    setMyBooks(r.books);
    setBookModal(true);
  };
  const setClubBook = async (b: any) => {
    const c = await api<any>(`/clubs/${id}`, { method: 'PATCH', body: JSON.stringify({ book: { book_id: b.book_id, title: b.title, author: b.author } }) });
    setClub(c);
    setBookModal(false);
  };
  const savePassage = async () => {
    if (!passageText.trim()) return;
    const c = await api<any>(`/clubs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ weekly_passage: { text: passageText.trim(), page: passagePage ? parseInt(passagePage, 10) : null, book_title: club.book?.title || null } }),
    });
    setClub(c);
    setPassageModal(false); setPassageText(''); setPassagePage('');
  };
  const leave = async () => {
    await api(`/clubs/${id}/leave`, { method: 'POST' });
    router.back();
  };

  const saveChallenge = async () => {
    if (!chTitle.trim() || !chGoal) return;
    const c = await api<any>(`/clubs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ challenge: { title: chTitle.trim(), goal_pages: parseInt(chGoal, 10) } }),
    });
    setClub(c);
    setChallengeModal(false); setChTitle(''); setChGoal('');
  };

  const saveMyProgress = async () => {
    const pages = parseInt(myPages, 10);
    if (isNaN(pages) || pages < 0) return;
    const c = await api<any>(`/clubs/${id}/challenge/progress`, { method: 'POST', body: JSON.stringify({ pages }) });
    setClub(c);
    setMyPages('');
  };

  const sendRecap = async () => {
    try {
      const m = await api<any>(`/clubs/${id}/recap`, { method: 'POST' });
      setMessages(prev => [...prev, m]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {}
  };

  const openReco = async () => {
    if (!myBooks.length) {
      try { const r = await api<{ books: any[] }>('/books'); setMyBooks(r.books); } catch {}
    }
    setRecoBook(null); setRecoNote('');
    setRecoModal(true);
  };

  const sendReco = async () => {
    if (!recoBook || !recoNote.trim()) return;
    const m = await api<any>(`/clubs/${id}/reco`, {
      method: 'POST',
      body: JSON.stringify({ title: recoBook.title, author: recoBook.author, note: recoNote.trim() }),
    });
    setMessages(prev => [...prev, m]);
    setRecoModal(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  if (!club) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center' }}>
        <ManentLoader size={48} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-club">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="club-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{club.name}</Text>
        <Pressable onPress={shareCode} testID="club-share" style={styles.iconBtn}>
          <Feather name="share" size={19} color={colors.espresso} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.md }}>
        {!!club.description && <Text style={styles.desc}>{club.description}</Text>}
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>{t('Code d’invitation')}</Text>
          <Text style={styles.code} testID="club-code">{club.code}</Text>
          <Text style={styles.membersCount}>{t(club.members_count > 1 ? '{n} membres' : '{n} membre', { n: club.members_count })} · {club.members.map((m: any) => m.pseudo).join(', ')}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('Lecture commune')}</Text>
        {club.book ? (
          <View style={styles.bookRow}>
            <View style={styles.bookCover}><Text style={styles.bookInitial}>{(club.book.title?.[0] || 'M').toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookTitle}>{club.book.title}</Text>
              {!!club.book.author && <Text style={styles.bookAuthor}>{club.book.author}</Text>}
            </View>
            {club.is_owner && (
              <Pressable testID="club-change-book" onPress={openBookPicker} hitSlop={8}>
                <Feather name="edit-2" size={16} color={colors.clay} />
              </Pressable>
            )}
          </View>
        ) : club.is_owner ? (
          <Pressable testID="club-set-book" onPress={openBookPicker} style={styles.dashedBtn}>
            <Feather name="book-open" size={18} color={colors.chambray} />
            <Text style={styles.dashedBtnText}>{t('Choisir le livre du club')}</Text>
          </Pressable>
        ) : (
          <Text style={styles.emptyText}>{t('Le livre du club n’est pas encore choisi.')}</Text>
        )}

        <Text style={styles.sectionLabel}>{t('Passage de la semaine')}</Text>
        {club.weekly_passage ? (
          <View style={styles.passageCard} testID="club-passage">
            <Text style={styles.passageMark}>&ldquo;</Text>
            <Text style={styles.passageText}>{club.weekly_passage.text}</Text>
            <Text style={styles.passageMeta}>
              {club.weekly_passage.book_title ? club.weekly_passage.book_title.toUpperCase() : ''}
              {club.weekly_passage.page ? `  ·  P. ${club.weekly_passage.page}` : ''}
              {club.weekly_passage.set_by ? `  ·  PROPOSÉ PAR ${String(club.weekly_passage.set_by).toUpperCase()}` : ''}
            </Text>
            {club.is_owner && (
              <Pressable testID="club-edit-passage" onPress={() => { setPassageText(club.weekly_passage.text); setPassagePage(club.weekly_passage.page ? String(club.weekly_passage.page) : ''); setPassageModal(true); }} style={styles.passageEdit}>
                <Feather name="edit-2" size={14} color={colors.clay} />
              </Pressable>
            )}
          </View>
        ) : club.is_owner ? (
          <Pressable testID="club-set-passage" onPress={() => setPassageModal(true)} style={styles.dashedBtn}>
            <Feather name="feather" size={18} color={colors.chambray} />
            <Text style={styles.dashedBtnText}>{t('Définir le passage de la semaine')}</Text>
          </Pressable>
        ) : (
          <Text style={styles.emptyText}>{t('Aucun passage proposé cette semaine.')}</Text>
        )}

        <Text style={styles.sectionLabel}>{t('Défi de lecture')}</Text>
        {club.challenge ? (
          <View style={styles.challengeCard} testID="club-challenge">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.challengeTitle}>{club.challenge.title}</Text>
                <Text style={styles.challengeGoal}>{t('Objectif : {n} pages', { n: club.challenge.goal_pages })}</Text>
              </View>
              {club.is_owner && (
                <Pressable testID="club-edit-challenge" onPress={() => { setChTitle(club.challenge.title); setChGoal(String(club.challenge.goal_pages)); setChallengeModal(true); }} hitSlop={8}>
                  <Feather name="edit-2" size={15} color={colors.clay} />
                </Pressable>
              )}
            </View>
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {club.challenge.leaderboard?.map((m: any, i: number) => (
                <View key={m.handle + i} style={styles.rankRow}>
                  <Text style={styles.rankNum}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rankName, m.is_me && { fontFamily: fonts.bodyMedium }]}>{m.pseudo}{m.is_me ? t(' (toi)') : ''}</Text>
                    <View style={styles.rankBar}><View style={[styles.rankFill, { width: `${m.pct}%` }]} /></View>
                  </View>
                  <Text style={styles.rankPages}>{m.pages} p.</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
              <TextInput
                testID="challenge-my-pages"
                value={myPages} onChangeText={setMyPages}
                keyboardType="number-pad"
                placeholder={t('Ta page actuelle ({n})', { n: club.challenge.my_pages || 0 })}
                placeholderTextColor={colors.clay}
                style={styles.progressInput}
              />
              <Pressable testID="challenge-save-progress" onPress={saveMyProgress} disabled={!myPages} style={[styles.progressBtn, !myPages && { opacity: 0.5 }]}>
                <Feather name="check" size={18} color={colors.creme} />
              </Pressable>
            </View>
          </View>
        ) : club.is_owner ? (
          <Pressable testID="club-set-challenge" onPress={() => setChallengeModal(true)} style={styles.dashedBtn}>
            <Feather name="flag" size={18} color={colors.chambray} />
            <Text style={styles.dashedBtnText}>{t('Lancer un défi de lecture')}</Text>
          </Pressable>
        ) : (
          <Text style={styles.emptyText}>{t('Aucun défi en cours.')}</Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm }}>
          <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>{t('Discussion')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Pressable testID="club-reco-btn" onPress={openReco} hitSlop={8}>
              <Text style={styles.recapLink}>{t('Recommander un livre')}</Text>
            </Pressable>
            {club.is_owner && (club.weekly_passage || club.challenge) ? (
              <Pressable testID="club-send-recap" onPress={sendRecap} hitSlop={8}>
                <Text style={styles.recapLink}>{t('Envoyer le récap')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>{t('Lance la conversation — premier mot sur la lecture ?')}</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {messages.map(m => m.is_system ? (
              <View key={m.message_id} style={styles.recapCard} testID="recap-message">
                <Text style={styles.recapLabel}>{t('Manent · Récap')}</Text>
                <Text style={styles.recapText}>{m.text}</Text>
              </View>
            ) : m.is_reco ? (
              <View key={m.message_id} style={styles.recoCard} testID="reco-message">
                <Text style={styles.recapLabel}>{t('Reco de {pseudo}', { pseudo: m.author?.pseudo || '' })}</Text>
                <Text style={styles.recoTitle}>{m.book?.title}</Text>
                {!!m.book?.author && <Text style={styles.recoAuthor}>{m.book.author}</Text>}
                <Text style={styles.recoNote}>« {m.text} »</Text>
              </View>
            ) : (
              <View key={m.message_id} style={[styles.msg, m.is_me && styles.msgMine]}>
                {!m.is_me && <Text style={styles.msgAuthor}>{m.author?.pseudo}</Text>}
                <Text style={[styles.msgText, m.is_me && { color: colors.espresso }]}>{m.text}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable testID="club-leave" onPress={leave} style={styles.leaveBtn}>
          <Text style={styles.leaveText}>{t('Quitter le club')}</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          testID="club-msg-input"
          value={msg} onChangeText={setMsg}
          placeholder={t('Écris au club…')}
          placeholderTextColor={colors.clay}
          style={styles.input}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable testID="club-msg-send" onPress={send} disabled={sending || !msg.trim()} style={[styles.sendBtn, (!msg.trim() || sending) && { opacity: 0.5 }]}>
          {sending ? <ManentLoader size={20} /> : <Feather name="arrow-up" size={20} color={colors.creme} />}
        </Pressable>
      </View>

      <Modal visible={bookModal} transparent animationType="slide" onRequestClose={() => setBookModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{t('Livre du club')}</Text>
            <FlatList
              data={myBooks}
              keyExtractor={x => x.book_id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <Pressable testID={`club-book-${item.book_id}`} onPress={() => setClubBook(item)} style={styles.pickRow}>
                  <Feather name="book" size={18} color={colors.chambray} />
                  <Text style={styles.pickTitle} numberOfLines={1}>{item.title}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>{t('Ajoute d’abord un livre à ta bibliothèque.')}</Text>}
            />
            <GhostButton title={t('Fermer')} onPress={() => setBookModal(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={recoModal} transparent animationType="slide" onRequestClose={() => setRecoModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{t('Recommander un livre')}</Text>
            <FlatList
              data={myBooks}
              keyExtractor={x => x.book_id}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => (
                <Pressable testID={`reco-book-${item.book_id}`} onPress={() => setRecoBook(item)} style={[styles.pickRow, recoBook?.book_id === item.book_id && { borderColor: colors.chambray, borderWidth: 1.5 }]}>
                  <Feather name={recoBook?.book_id === item.book_id ? 'check-circle' : 'book'} size={18} color={colors.chambray} />
                  <Text style={styles.pickTitle} numberOfLines={1}>{item.title}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>{t('Ajoute d’abord un livre à ta bibliothèque.')}</Text>}
            />
            <TextInput
              testID="reco-note"
              value={recoNote} onChangeText={setRecoNote}
              placeholder={t('Ton petit mot (pourquoi ce livre ?)')}
              placeholderTextColor={colors.clay}
              style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top', marginTop: spacing.sm }]}
              multiline
            />
            <View style={{ height: spacing.sm }} />
            <PrimaryButton testID="reco-send" title={t('Envoyer la reco')} onPress={sendReco} disabled={!recoBook || !recoNote.trim()} />
            <GhostButton title={t('Annuler')} onPress={() => setRecoModal(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={challengeModal} transparent animationType="slide" onRequestClose={() => setChallengeModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{t('Défi de lecture')}</Text>
            <TextInput testID="challenge-title" value={chTitle} onChangeText={setChTitle} placeholder={t('Nom du défi (ex: Finir Candide en mai)')} placeholderTextColor={colors.clay} style={styles.modalInput} />
            <TextInput testID="challenge-goal" value={chGoal} onChangeText={setChGoal} keyboardType="number-pad" placeholder={t('Objectif en pages (ex: 150)')} placeholderTextColor={colors.clay} style={styles.modalInput} />
            <View style={{ height: spacing.md }} />
            <PrimaryButton testID="challenge-save" title={t('Lancer le défi')} onPress={saveChallenge} disabled={!chTitle.trim() || !chGoal} />
            <GhostButton title={t('Annuler')} onPress={() => setChallengeModal(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={passageModal} transparent animationType="slide" onRequestClose={() => setPassageModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{t('Passage de la semaine')}</Text>
            <TextInput testID="passage-text" value={passageText} onChangeText={setPassageText} placeholder={t('Le passage à méditer ensemble…')} placeholderTextColor={colors.clay} style={[styles.modalInput, { minHeight: 100, textAlignVertical: 'top' }]} multiline />
            <TextInput testID="passage-page" value={passagePage} onChangeText={setPassagePage} keyboardType="number-pad" placeholder={t('Page (optionnel)')} placeholderTextColor={colors.clay} style={styles.modalInput} />
            <View style={{ height: spacing.md }} />
            <PrimaryButton testID="passage-save" title={t('Publier le passage')} onPress={savePassage} disabled={!passageText.trim()} />
            <GhostButton title={t('Annuler')} onPress={() => setPassageModal(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.espresso, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  desc: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginBottom: spacing.md, lineHeight: 20 },
  codeRow: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, alignItems: 'center' },
  codeLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  code: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.chambray, letterSpacing: 6, marginTop: 2 },
  membersCount: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 4, textAlign: 'center' },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  bookCover: { width: 40, height: 56, borderRadius: radius.sm, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  bookInitial: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  bookTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.espresso },
  bookAuthor: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  dashedBtn: { height: 60, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.creme },
  dashedBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.chambray },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, fontStyle: 'italic' },
  passageCard: { backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.lg, paddingTop: spacing.sm },
  passageMark: { fontFamily: fonts.displayMedium, fontSize: 54, color: colors.chambray, lineHeight: 52, marginBottom: -6, marginLeft: -4 },
  passageText: { fontFamily: fonts.display, fontSize: 19, color: colors.espresso, lineHeight: 27 },
  passageMeta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, marginTop: spacing.md },
  passageEdit: { position: 'absolute', top: spacing.md, right: spacing.md },
  challengeCard: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  challengeTitle: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.espresso },
  challengeGoal: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankNum: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.clay, width: 20, textAlign: 'center' },
  rankName: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  rankBar: { height: 4, backgroundColor: colors.glacier, borderRadius: 2, overflow: 'hidden', marginTop: 3 },
  rankFill: { height: 4, backgroundColor: colors.chambray },
  rankPages: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso, width: 44, textAlign: 'right' },
  progressInput: { flex: 1, height: 44, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, backgroundColor: colors.glacier },
  progressBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  msg: { alignSelf: 'flex-start', maxWidth: '82%', backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  msgMine: { alignSelf: 'flex-end', backgroundColor: colors.bisque, borderColor: colors.bisque },
  msgAuthor: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.chambray, marginBottom: 2 },
  msgText: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, lineHeight: 20 },
  recapLink: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, textDecorationLine: 'underline' },
  recapCard: { backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md },
  recapLabel: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  recapText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 20 },
  recoCard: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.chambray, padding: spacing.md },
  recoTitle: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.espresso },
  recoAuthor: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 1 },
  recoNote: { fontFamily: fonts.display, fontSize: 15, color: colors.espresso, marginTop: spacing.sm, lineHeight: 21 },
  leaveBtn: { alignSelf: 'center', marginTop: spacing.xl, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  leaveText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.clay },
  inputBar: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft, backgroundColor: colors.glacier },
  input: { flex: 1, height: 46, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.pill, paddingHorizontal: spacing.lg, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, backgroundColor: colors.creme },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.glacier, padding: spacing.xl, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grabber: { width: 44, height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, marginBottom: spacing.md },
  modalInput: { minHeight: 48, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme, marginBottom: spacing.sm },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8 },
  pickTitle: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
});
