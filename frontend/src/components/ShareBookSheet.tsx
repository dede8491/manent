import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { shareUrl } from '@/src/share';
import { BottomSheet } from '@/src/components/BottomSheet';
import { BookCover } from '@/src/components/BookCover';
import { GhostButton, PrimaryButton } from '@/src/components/Button';
import ManentLoader from '@/src/components/ManentLoader';
import { useAuth } from '@/src/auth';
import { useT } from '@/src/i18n';

type Mode = 'menu' | 'reader' | 'club' | 'done';
type Reader = { pseudo: string; handle: string; picture?: string | null; accepts: boolean };
type Club = { club_id: string; name: string; visibility?: string };

// Partager un livre : à une lectrice (recommandation), à un club (proposition de lecture),
// ou par lien. Aucune messagerie libre : un livre, un mot de 140 caractères au plus.
export function ShareBookSheet({ visible, onClose, book, testID = 'share-book' }: {
  visible: boolean; onClose: () => void;
  book: { catalog_id?: string | null; title: string; author?: string | null; cover?: string | null };
  testID?: string;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('menu');
  const [readers, setReaders] = useState<Reader[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<Reader | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneText, setDoneText] = useState('');

  useEffect(() => {
    if (!visible) { setMode('menu'); setTarget(null); setClub(null); setMessage(''); setError(''); setQ(''); return; }
    (async () => {
      try { const r = await api<{ readers: Reader[] }>('/readers/contacts'); setReaders(r.readers || []); } catch {}
      try { const c = await api<{ clubs: Club[] }>('/clubs'); setClubs(c.clubs || []); } catch {}
    })();
  }, [visible]);

  const shownReaders = readers.filter(r => !q.trim() || r.pseudo.toLowerCase().includes(q.trim().toLowerCase()) || r.handle.toLowerCase().includes(q.trim().toLowerCase()));

  const shareLink = async () => {
    const url = book.catalog_id ? shareUrl.book(book.catalog_id) : '';
    const message = url ? t('« {title} » sur Manent — {url}', { title: book.title, url }) : t('« {title} » sur Manent', { title: book.title });
    try {
      if (Platform.OS === 'web') {
        const nav: any = navigator;
        if (nav.share) await nav.share({ title: 'Manent', text: message });
        else if (nav.clipboard) { await nav.clipboard.writeText(message); setDoneText(t('Lien copié dans le presse-papiers.')); setMode('done'); return; }
      } else {
        await Share.share({ message });
      }
      onClose();
    } catch {}
  };

  const sendToReader = async () => {
    if (!target || !book.catalog_id || busy) return;
    setBusy(true); setError('');
    try {
      await api('/recommendations', { method: 'POST', body: JSON.stringify({ to_handle: target.handle, catalog_id: book.catalog_id, message: message.trim() || undefined }) });
      setDoneText(t('Recommandé à {pseudo}.', { pseudo: target.pseudo }));
      setMode('done');
    } catch (e: any) {
      setError(e?.detail?.detail === 'recommendations_disabled' ? t('Cette lectrice ne reçoit pas de recommandations.') : t('Envoi impossible. Réessaie.'));
    } finally { setBusy(false); }
  };

  const sendToClub = async () => {
    if (!club || busy) return;
    setBusy(true); setError('');
    try {
      await api(`/clubs/${club.club_id}/reco`, { method: 'POST', body: JSON.stringify({ title: book.title, author: book.author || undefined, note: message.trim() || t('Je propose ce livre pour notre prochaine lecture.') }) });
      setDoneText(t('Proposé au club {name}.', { name: club.name }));
      setMode('done');
    } catch { setError(t('Envoi impossible. Réessaie.')); }
    finally { setBusy(false); }
  };

  const title = mode === 'reader' ? t('À une lectrice') : mode === 'club' ? t('À un club') : mode === 'done' ? t('C’est envoyé') : t('Partager ce livre');

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={mode === 'menu' ? book.title : undefined} testID={testID}>
      {mode === 'menu' && (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Pressable testID={`${testID}-reader`} onPress={() => setMode('reader')} disabled={!book.catalog_id} style={[styles.row, !book.catalog_id && { opacity: 0.5 }]}>
            <Feather name="user" size={18} color={colors.chambray} />
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{t('À une lectrice')}</Text><Text style={styles.rowSub}>{t('Une recommandation, avec un petit mot.')}</Text></View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>
          <Pressable testID={`${testID}-club`} onPress={() => setMode('club')} style={styles.row}>
            <Feather name="users" size={18} color={colors.chambray} />
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{t('À un club')}</Text><Text style={styles.rowSub}>{t('Une proposition de lecture pour le club.')}</Text></View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>
          <Pressable testID={`${testID}-link`} onPress={shareLink} style={styles.row}>
            <Feather name="link" size={18} color={colors.chambray} />
            <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{t('Lien')}</Text><Text style={styles.rowSub}>{t('Ouvre la fiche dans Manent, ou la page Rejoindre.')}</Text></View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>
          {!book.catalog_id && <Text style={styles.hint}>{t('Ce livre n’est pas encore dans le catalogue : seul le partage par lien est possible.')}</Text>}
        </View>
      )}

      {mode === 'reader' && (
        <View style={{ marginTop: spacing.sm }}>
          {!target ? (
            <>
              <View style={styles.searchBox}>
                <Feather name="search" size={15} color={colors.clay} />
                <TextInput testID={`${testID}-search`} value={q} onChangeText={setQ} placeholder={t('Chercher par pseudo…')} placeholderTextColor={colors.clay} style={styles.searchInput} autoCapitalize="none" />
              </View>
              {readers.length === 0 ? (
                <Text style={styles.hint}>{t('Suis des lectrices, ou laisse-les te suivre, pour leur recommander des livres.')}</Text>
              ) : shownReaders.map(r => (
                <Pressable key={r.handle} testID={`${testID}-to-${r.handle}`} onPress={() => r.accepts && setTarget(r)} style={[styles.reader, !r.accepts && { opacity: 0.45 }]}>
                  <View style={styles.avatar}>{r.picture ? <Image source={{ uri: r.picture }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : <Text style={styles.avatarText}>{(r.pseudo[0] || 'M').toUpperCase()}</Text>}</View>
                  <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{r.pseudo}</Text><Text style={styles.rowSub}>@{r.handle}{!r.accepts ? `  ·  ${t('ne reçoit pas de recommandations')}` : ''}</Text></View>
                  <Feather name="chevron-right" size={16} color={colors.clay} />
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.toLine}>{t('Pour {pseudo}', { pseudo: target.pseudo })}  ·  <Text onPress={() => setTarget(null)} style={styles.change}>{t('changer')}</Text></Text>
              <TextInput testID={`${testID}-message`} value={message} onChangeText={v => setMessage(v.slice(0, 140))} placeholder={t('Un mot pour accompagner (optionnel)')} placeholderTextColor={colors.clay} style={styles.input} multiline maxLength={140} />
              <Text style={styles.counter}>{message.length}/140</Text>
              <Text style={styles.previewLabel}>{t('Ce que {pseudo} recevra', { pseudo: target.pseudo })}</Text>
              <View style={styles.preview} testID={`${testID}-preview`}>
                <BookCover uri={book.cover} title={book.title} width={48} height={70} radius={5} initialSize={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewFrom}>{t('de @{handle}', { handle: user?.handle || '' })}</Text>
                  <Text style={styles.previewTitle} numberOfLines={2}>{book.title}</Text>
                  {!!book.author && <Text style={styles.previewAuthor} numberOfLines={1}>{book.author}</Text>}
                  {!!message.trim() && <Text style={styles.previewMsg} numberOfLines={3}>« {message.trim()} »</Text>}
                </View>
              </View>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <PrimaryButton testID={`${testID}-send-reader`} title={t('Envoyer la recommandation')} onPress={sendToReader} loading={busy} />
            </>
          )}
          <GhostButton title={t('Retour')} onPress={() => (target ? setTarget(null) : setMode('menu'))} />
        </View>
      )}

      {mode === 'club' && (
        <View style={{ marginTop: spacing.sm }}>
          {!club ? (
            clubs.length === 0 ? (
              <Text style={styles.hint}>{t('Tu ne fais partie d’aucun club pour l’instant.')}</Text>
            ) : clubs.map(c => (
              <Pressable key={c.club_id} testID={`${testID}-club-${c.club_id}`} onPress={() => setClub(c)} style={styles.reader}>
                <View style={styles.avatar}><Feather name={c.visibility === 'public' ? 'globe' : 'lock'} size={15} color={colors.chambray} /></View>
                <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                <Feather name="chevron-right" size={16} color={colors.clay} />
              </Pressable>
            ))
          ) : (
            <>
              <Text style={styles.toLine}>{t('Pour le club {name}', { name: club.name })}  ·  <Text onPress={() => setClub(null)} style={styles.change}>{t('changer')}</Text></Text>
              <TextInput testID={`${testID}-club-message`} value={message} onChangeText={v => setMessage(v.slice(0, 140))} placeholder={t('Pourquoi ce livre ? (optionnel)')} placeholderTextColor={colors.clay} style={styles.input} multiline maxLength={140} />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <PrimaryButton testID={`${testID}-send-club`} title={t('Proposer au club')} onPress={sendToClub} loading={busy} />
            </>
          )}
          <GhostButton title={t('Retour')} onPress={() => (club ? setClub(null) : setMode('menu'))} />
        </View>
      )}

      {mode === 'done' && (
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md }}>
          <View style={styles.doneIcon}><Feather name="check" size={22} color={colors.creme} /></View>
          <Text style={styles.doneText} testID={`${testID}-done`}>{doneText}</Text>
          <PrimaryButton title={t('Fermer')} onPress={onClose} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
      {busy && mode === 'menu' && <ManentLoader size={18} />}
    </BottomSheet>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  rowTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 1 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, lineHeight: 18, marginTop: spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, paddingVertical: 0 },
  reader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.espresso },
  toLine: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, marginBottom: spacing.sm },
  change: { color: colors.chambray, textDecorationLine: 'underline' },
  input: { minHeight: 80, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, padding: spacing.md, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, backgroundColor: colors.creme, textAlignVertical: 'top' },
  counter: { fontFamily: fonts.body, fontSize: 11, color: colors.clay, alignSelf: 'flex-end', marginTop: 4, marginBottom: spacing.sm },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginBottom: spacing.sm },
  previewLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  preview: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, marginBottom: spacing.md },
  previewFrom: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 0.5 },
  previewTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso, marginTop: 2, lineHeight: 21 },
  previewAuthor: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 1 },
  previewMsg: { fontFamily: fonts.display, fontSize: 14, color: colors.espresso, marginTop: 6, lineHeight: 19 },
  doneIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, textAlign: 'center' },
});
