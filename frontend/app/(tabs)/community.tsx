import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { ClubHome } from '@/src/components/ClubHome';
import { InfoTooltip } from '@/src/components/InfoTooltip';
import { useT } from '@/src/i18n';

type Board = {
  board_id: string;
  name: string;
  description?: string;
  visibility: 'private' | 'public' | 'collaborative';
  pins_count?: number;
  preview_quote?: string | null;
};

export default function Community() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<'boards' | 'clubs'>('boards');
  const [boards, setBoards] = useState<Board[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [visibility, setVisibility] = useState<'private'|'public'|'collaborative'>('private');
  const [creating, setCreating] = useState(false);
  const [clubModal, setClubModal] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubDesc, setClubDesc] = useState('');
  const [clubVisibility, setClubVisibility] = useState<'private' | 'public'>('private');
  const [joinModal, setJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [readers, setReaders] = useState<any[]>([]);
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const r = await api<{ boards: Board[] }>('/boards'); setBoards(r.boards);
    try { const c = await api<{ clubs: any[] }>('/clubs'); setClubs(c.clubs); } catch {}
    try { const s = await api<{ readers: any[] }>('/readers/suggestions'); setReaders(s.readers); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const followReader = async (handle: string) => {
    try {
      const r = await api<{ following: boolean }>(`/readers/${encodeURIComponent(handle)}/follow`, { method: 'POST' });
      setFollowedSet(prev => {
        const next = new Set(prev);
        if (r.following) next.add(handle); else next.delete(handle);
        return next;
      });
    } catch {}
  };

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const b = await api<Board>('/boards', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: desc, visibility }) });
      setModal(false); setName(''); setDesc(''); setVisibility('private');
      await load();
      router.push({ pathname: '/board/[id]', params: { id: b.board_id } });
    } finally { setCreating(false); }
  };

  const createClub = async () => {
    if (!clubName.trim()) return;
    setCreating(true);
    try {
      const c = await api<any>('/clubs', { method: 'POST', body: JSON.stringify({ name: clubName.trim(), description: clubDesc, visibility: clubVisibility }) });
      setClubModal(false); setClubName(''); setClubDesc(''); setClubVisibility('private');
      await load();
      router.push({ pathname: '/club/[id]', params: { id: c.club_id } });
    } finally { setCreating(false); }
  };

  const joinClub = async () => {
    if (!joinCode.trim()) return;
    setJoinError('');
    setCreating(true);
    try {
      const r = await api<{ club_id: string }>('/clubs/join', { method: 'POST', body: JSON.stringify({ code: joinCode.trim() }) });
      setJoinModal(false); setJoinCode('');
      await load();
      router.push({ pathname: '/club/[id]', params: { id: r.club_id } });
    } catch {
      setJoinError(t('Code inconnu. Vérifie auprès du club.'));
    } finally { setCreating(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-community">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.h1}>{tab === 'boards' ? t('Tes tableaux') : t('Club de lecture')}</Text>
          <InfoTooltip
            testID="info-community"
            title={tab === 'boards' ? t('Tes tableaux') : t('Le Club de lecture')}
            text={tab === 'boards'
              ? t("Tes tableaux fonctionnent comme des moodboards : épingle tes citations par thème (Résilience, Amour, Nuit…). Un tableau peut rester privé, devenir public sur ton profil, ou collaboratif pour épingler à plusieurs.")
              : t("Le Club réunit la communauté autour d'un Livre du mois élu par sondage. Rejoins une lecture, discute chapitre par chapitre, participe aux événements et gagne des points au challenge de l'année.")}
          />
        </View>
        <Text style={styles.sub}>{tab === 'boards' ? t('Épingle les passages qui te ressemblent.') : t('Découvrez, lisez et discutez ensemble.')}</Text>
        <View style={styles.segmentRow}>
          {([['boards', 'Tableaux'], ['clubs', 'Club de lecture']] as const).map(([tb, label]) => (
            <Pressable key={tb} testID={`community-tab-${tb}`} onPress={() => setTab(tb)} style={[styles.segment, tab === tb && styles.segmentActive]}>
              <Text style={[styles.segmentText, tab === tb && styles.segmentTextActive]}>{t(label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {readers.length > 0 && (
        <View style={styles.suggestBlock}>
          <Text style={styles.suggestLabel}>{t('Lecteurs à découvrir')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
            {readers.map(r => {
              const isF = followedSet.has(r.handle);
              return (
                <Pressable key={r.handle} testID={`suggest-reader-${r.handle}`} onPress={() => router.push({ pathname: '/reader/[handle]', params: { handle: r.handle } })} style={styles.readerCard}>
                  <View style={styles.readerAvatar}>{r.picture ? <Image source={{ uri: r.picture }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : <Text style={styles.readerInitial}>{(r.pseudo?.[0] || 'M').toUpperCase()}</Text>}</View>
                  <Text style={styles.readerName} numberOfLines={1}>{r.pseudo}</Text>
                  <Text style={styles.readerMeta} numberOfLines={1}>
                    {r.shared_themes?.length ? r.shared_themes.join(' · ') : t('{n} citations publiques', { n: r.public_quotes })}
                  </Text>
                  <Pressable testID={`suggest-follow-${r.handle}`} onPress={() => followReader(r.handle)} style={[styles.readerFollowBtn, isF && styles.readerFollowingBtn]} hitSlop={6}>
                    <Text style={[styles.readerFollowText, isF && { color: colors.espresso }]}>{isF ? t('Suivi') : t('Suivre')}</Text>
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
      {tab === 'boards' ? (
      <FlatList
        key="list-boards"
        data={boards}
        keyExtractor={x => x.board_id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.xl }}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: insets.bottom + 80, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
            <Pressable testID="btn-new-board" onPress={() => setModal(true)} style={styles.newCard}>
              <Feather name="plus" size={22} color={colors.chambray} />
              <Text style={styles.newCardText}>{t('Nouveau tableau')}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable testID={`board-${item.board_id}`} onPress={() => router.push({ pathname: '/board/[id]', params: { id: item.board_id } })} style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
            {item.preview_quote ? (
              <Text style={styles.preview} numberOfLines={3}>&ldquo; {item.preview_quote}</Text>
            ) : (
              <Text style={styles.previewEmpty}>{t("Ton premier passage l'attend.")}</Text>
            )}
            <View style={{ flex: 1 }} />
            <Text style={styles.meta}>{item.visibility === 'private' ? t('PRIVÉ') : item.visibility === 'public' ? t('PUBLIC') : t('COLLABORATIF')} · {t('{n} épingles', { n: item.pins_count || 0 })}</Text>
          </Pressable>
        )}
        ListEmptyComponent={(
          <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl }}>
            <Text style={styles.emptyTitle}>{t("Ton premier tableau t'attend.")}</Text>
            <Text style={styles.emptySub}>{t("Rassemble tes citations autour d'un thème.")}</Text>
          </View>
        )}
      />
      ) : (
      <ClubHome
        clubs={clubs}
        onOpenClub={(cid: string) => router.push({ pathname: '/club/[id]', params: { id: cid } })}
        onCreateClub={() => setClubModal(true)}
        onJoinClub={() => { setJoinError(''); setJoinModal(true); }}
      />
      )}

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{t('Nouveau tableau')}</Text>
            <TextInput testID="new-board-name" value={name} onChangeText={setName} placeholder={t('Nom (ex: Résilience)')} placeholderTextColor={colors.clay} style={styles.input} />
            <TextInput testID="new-board-desc" value={desc} onChangeText={setDesc} placeholder={t('Description (optionnel)')} placeholderTextColor={colors.clay} style={[styles.input, { height: 80 }]} multiline />
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {(['private','public','collaborative'] as const).map(v => (
                <Pressable key={v} testID={`visibility-${v}`} onPress={() => setVisibility(v)} style={[styles.visCard, visibility === v && styles.visCardActive]}>
                  <Text style={[styles.visLabel, visibility === v && { color: colors.creme }]}>
                    {v === 'private' ? t('Privé') : v === 'public' ? t('Public') : t('Collaboratif')}
                  </Text>
                  <Text style={[styles.visDesc, visibility === v && { color: colors.creme, opacity: 0.9 }]}>
                    {v === 'private' ? t('Toi seule.') : v === 'public' ? t('Sur ton profil, dans la découverte.') : t('Les invités peuvent aussi épingler.')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ height: spacing.lg }} />
            <PrimaryButton testID="btn-create-board" title={t('Créer le tableau')} onPress={create} loading={creating} disabled={!name.trim()} />
            <GhostButton title={t('Annuler')} onPress={() => setModal(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={clubModal} animationType="slide" transparent onRequestClose={() => setClubModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{t('Nouveau club')}</Text>
            <TextInput testID="new-club-name" value={clubName} onChangeText={setClubName} placeholder={t('Nom (ex: Les soirées Voltaire)')} placeholderTextColor={colors.clay} style={styles.input} />
            <TextInput testID="new-club-desc" value={clubDesc} onChangeText={setClubDesc} placeholder={t('Description (optionnel)')} placeholderTextColor={colors.clay} style={[styles.input, { height: 80 }]} multiline />
            <View style={{ gap: spacing.sm }}>
              {(['private', 'public'] as const).map(v => (
                <Pressable key={v} testID={`club-visibility-${v}`} onPress={() => setClubVisibility(v)} style={[styles.visCard, clubVisibility === v && styles.visCardActive]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name={v === 'private' ? 'lock' : 'globe'} size={14} color={clubVisibility === v ? colors.creme : colors.chambray} />
                    <Text style={[styles.visLabel, clubVisibility === v && { color: colors.creme }]}>
                      {v === 'private' ? t('Club fermé') : t('Club public')}
                    </Text>
                  </View>
                  <Text style={[styles.visDesc, clubVisibility === v && { color: colors.creme, opacity: 0.9 }]}>
                    {v === 'private' ? t('Sur invitation uniquement — un code sera généré pour tes invités.') : t('Visible par toute la communauté, chacun peut le rejoindre librement.')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ height: spacing.md }} />
            <PrimaryButton testID="btn-create-club" title={t('Créer le club')} onPress={createClub} loading={creating} disabled={!clubName.trim()} />
            <GhostButton title={t('Annuler')} onPress={() => setClubModal(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={joinModal} animationType="slide" transparent onRequestClose={() => setJoinModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{t('Rejoindre un club')}</Text>
            <TextInput testID="join-club-code" value={joinCode} onChangeText={t => setJoinCode(t.toUpperCase())} placeholder={t('Code (ex: A7K2PX)')} autoCapitalize="characters" placeholderTextColor={colors.clay} style={[styles.input, styles.codeInput]} maxLength={6} />
            {joinError ? <Text style={styles.joinError} testID="join-club-error">{joinError}</Text> : null}
            <View style={{ height: spacing.md }} />
            <PrimaryButton testID="btn-join-club-confirm" title={t('Rejoindre')} onPress={joinClub} loading={creating} disabled={joinCode.trim().length < 4} />
            <GhostButton title={t('Annuler')} onPress={() => setJoinModal(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  suggestBlock: { marginBottom: spacing.md },
  suggestLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  readerCard: { width: 150, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, alignItems: 'center', gap: 4 },
  readerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  readerInitial: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  readerName: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.espresso },
  readerMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.clay },
  readerFollowBtn: { marginTop: 6, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.chambray, minHeight: 30, justifyContent: 'center' },
  readerFollowingBtn: { backgroundColor: colors.glacier, borderWidth: 1, borderColor: colors.borderSoft },
  readerFollowText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.creme },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.glacier },
  h1: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: 4 },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  segment: { flex: 1, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  segmentText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  segmentTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  modalHint: { fontFamily: fonts.body, fontSize: 12, color: colors.clay },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontFamily: fonts.bodyMedium, fontSize: 20 },
  joinError: { fontFamily: fonts.body, fontSize: 13, color: colors.clay },
  newCard: { height: 72, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.creme },
  newCardText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.chambray },
  card: { flex: 1, minHeight: 180, backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  preview: { fontFamily: fonts.display, fontSize: 14, color: colors.espresso, lineHeight: 20 },
  previewEmpty: { fontFamily: fonts.body, fontSize: 12, color: colors.clay },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase' },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.35)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.glacier, padding: spacing.xl, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grabber: { width: 44, height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, marginBottom: spacing.md },
  input: { height: 52, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme, marginBottom: spacing.sm },
  visCard: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  visCardActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  visLabel: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso },
  visDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
});
