import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, FlatList, Platform, Alert, Linking, TextInput, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { ShareQuoteCard } from '@/src/components/ShareQuoteCard';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { shareUrl } from '@/src/share';
import { useT } from '@/src/i18n';
import { GhostButton } from '@/src/components/Button';
import ManentLoader from '@/src/components/ManentLoader';

export default function QuoteDetail() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [style, setStyle] = useState<'papier'|'encre'|'glacier'>('papier');
  const [pinning, setPinning] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);
  const shareRef = useRef<View>(null);
  const [busy, setBusy] = useState<null | 'save' | 'share'>(null);
  const [feedback, setFeedback] = useState('');
  const [comments, setComments] = useState<any[] | null>(null);
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const toggleLike = async () => {
    if (!quote) return;
    const q: any = quote;
    setQuote({ ...q, liked_by_me: !q.liked_by_me, likes_count: (q.likes_count || 0) + (q.liked_by_me ? -1 : 1) });
    try { const r = await api<{ liked: boolean; likes_count: number }>(`/quotes/${id}/like`, { method: 'POST' }); setQuote(prev => prev ? ({ ...(prev as any), liked_by_me: r.liked, likes_count: r.likes_count }) : prev); } catch {}
  };
  const loadComments = async () => {
    try { setComments((await api<{ comments: any[] }>(`/quotes/${id}/comments`)).comments || []); } catch { setComments([]); }
  };
  const sendComment = async () => {
    if (!comment.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const c = await api<any>(`/quotes/${id}/comments`, { method: 'POST', body: JSON.stringify({ text: comment.trim() }) });
      setComments(prev => [...(prev || []), c]); setComment('');
      setQuote(prev => prev ? ({ ...(prev as any), comments_count: c.comments_count }) : prev);
    } catch {} finally { setSendingComment(false); }
  };
  const deleteComment = async (cid: string) => {
    try { const r = await api<{ comments_count: number }>(`/quotes/${id}/comments/${cid}`, { method: 'DELETE' }); setComments(prev => (prev || []).filter(c => c.comment_id !== cid)); setQuote(prev => prev ? ({ ...(prev as any), comments_count: r.comments_count }) : prev); } catch {}
  };

  useEffect(() => {
    (async () => {
      const q = await api<Quote>(`/quotes/${id}`); setQuote(q);
    })();
  }, [id]);

  const openPin = async () => {
    const r = await api<{ boards: any[] }>('/boards'); setBoards(r.boards); setPinning(true);
  };
  const pinTo = async (boardId: string) => {
    await api(`/boards/${boardId}/pin`, { method: 'POST', body: JSON.stringify({ quote_id: id }) });
    setPinning(false);
  };
  const del = async () => {
    await api(`/quotes/${id}`, { method: 'DELETE' });
    router.back();
  };

  // ---- Export image 1080×1350 ----
  const capture = async (): Promise<string> => {
    if (Platform.OS === 'web') {
      // react-native-view-shot captureRef appelle findNodeHandle (non supporté sur web) :
      // on utilise html2canvas directement sur le nœud DOM du rendu offscreen.
      const mod = require('html2canvas');
      const html2canvas = mod.default || mod;
      const node = shareRef.current as any;
      const canvas = await html2canvas(node, { backgroundColor: null });
      const out = document.createElement('canvas');
      out.width = 1080; out.height = 1350;
      out.getContext('2d')!.drawImage(canvas, 0, 0, 1080, 1350);
      return out.toDataURL('image/png');
    }
    return await captureRef(shareRef, {
      format: 'png',
      quality: 1,
      width: 1080,
      height: 1350,
      result: 'tmpfile',
    });
  };

  const downloadWeb = (dataUri: string) => {
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = 'manent-citation.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openSettingsAlert = () => {
    Alert.alert(
      t('Accès aux photos'),
      t("Pour enregistrer ta quote card, autorise l'accès aux photos dans les réglages."),
      [
        { text: t('Annuler'), style: 'cancel' },
        { text: t('Ouvrir les réglages'), onPress: () => Linking.openSettings() },
      ],
    );
  };

  const ensureMediaPermission = async (): Promise<boolean> => {
    const current = await MediaLibrary.getPermissionsAsync(true);
    if (current.granted) return true;
    if (!current.canAskAgain) { openSettingsAlert(); return false; }
    const proceed = await new Promise<boolean>(resolve => {
      Alert.alert(
        t('Enregistrer dans ta galerie'),
        t("Manent enregistre ta quote card dans tes photos pour la partager facilement."),
        [
          { text: t('Annuler'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('Continuer'), onPress: () => resolve(true) },
        ],
      );
    });
    if (!proceed) return false;
    const req = await MediaLibrary.requestPermissionsAsync(true);
    if (req.granted) return true;
    if (!req.canAskAgain) openSettingsAlert();
    return false;
  };

  const saveToGallery = async () => {
    setFeedback('');
    setBusy('save');
    try {
      const st = await api<{ is_premium: boolean }>('/premium/status');
      if (!st.is_premium) {
        setFeedback("L'enregistrement en galerie est réservé au Premium.");
        router.push('/premium');
        return;
      }
      if (Platform.OS === 'web') {
        const uri = await capture();
        downloadWeb(uri);
        setFeedback(t('Image téléchargée.'));
      } else {
        const ok = await ensureMediaPermission();
        if (!ok) return;
        const uri = await capture();
        await MediaLibrary.saveToLibraryAsync(uri);
        setFeedback(t('Enregistrée dans ta galerie.'));
      }
    } catch (e) {
      console.error('capture/save failed', e);
      setFeedback("Impossible de générer l'image. Réessaie.");
    } finally { setBusy(null); }
  };

  const shareImage = async () => {
    setFeedback('');
    setBusy('share');
    const link = (quote as any)?.is_public ? shareUrl.quote((quote as any).quote_id) : null;
    try {
      const uri = await capture();
      if (Platform.OS === 'web') {
        try {
          const blob = await (await fetch(uri)).blob();
          const file = new File([blob], 'manent-citation.png', { type: 'image/png' });
          const nav: any = navigator;
          if (nav.canShare && nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], title: 'Manent', ...(link ? { text: link } : {}) });
          } else {
            downloadWeb(uri);
            setFeedback(t('Image téléchargée — partage-la sur Instagram ou WhatsApp.'));
          }
        } catch {
          downloadWeb(uri);
          setFeedback(t('Image téléchargée — partage-la sur Instagram ou WhatsApp.'));
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Partager la citation' });
          if (link) setFeedback(`${t('Lien de la citation :')} ${link}`);
        } else {
          setFeedback("Le partage n'est pas disponible sur cet appareil.");
        }
      }
    } catch {
      setFeedback("Impossible de générer l'image. Réessaie.");
    } finally { setBusy(null); }
  };

  if (!quote) return <View style={{ flex: 1, backgroundColor: colors.glacier }} />;

  const bg = style === 'encre' ? colors.espresso : style === 'glacier' ? colors.glacier : colors.bisque;
  const fg = style === 'encre' ? colors.creme : colors.espresso;

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-quote-detail">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="q-back" style={styles.iconBtn}><Feather name="chevron-left" size={22} color={colors.espresso} /></Pressable>
        <Text style={styles.h1}>{t('Citation')}</Text>
        {quote.is_owner !== false ? (
          <Pressable onPress={del} testID="q-delete" style={styles.iconBtn}><Feather name="trash-2" size={20} color={colors.espresso} /></Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={[styles.card, { backgroundColor: bg }]} testID="quote-card-hero">
          <Text style={[styles.mark, { color: style === 'encre' ? colors.chambray : colors.chambray }]}>&ldquo;</Text>
          <Text style={[styles.text, { color: fg }]}>{quote.text}</Text>
          <View style={[styles.divider, { backgroundColor: style === 'encre' ? colors.clay : colors.borderSoft }]} />
          <Pressable
            testID="quote-book-link"
            disabled={!(quote as any).book_id || !quote.is_owner}
            onPress={() => router.push({ pathname: '/book/[id]', params: { id: (quote as any).book_id, page: quote.page ? String(quote.page) : '' } })}
            style={{ flexDirection: 'row', alignItems: 'flex-end' }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.source, { color: style === 'encre' ? colors.creme : colors.clay }]}>{quote.book?.title || 'SANS TITRE'}</Text>
              {!!quote.book?.author && <Text style={[styles.authorLine, { color: style === 'encre' ? colors.creme : colors.clay }]}>{quote.book.author}</Text>}
              {!!(quote as any).book_id && quote.is_owner && (
                <Text style={[styles.openBook, { color: style === 'encre' ? colors.creme : colors.chambray }]}>{t('Ouvrir le livre')}  ›</Text>
              )}
            </View>
            {(quote.page || quote.chapter) ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.pageNum, { color: fg }]}>{quote.page || quote.chapter}</Text>
                <Text style={[styles.pageLbl, { color: style === 'encre' ? colors.creme : colors.clay }]}>{quote.book?.type === 'wattpad' ? 'CHAP.' : 'PAGE'}</Text>
              </View>
            ) : null}
          </Pressable>
          <Text style={[styles.brand, { color: style === 'encre' ? colors.creme : colors.clay }]}>Manent · @{quote.author?.handle}</Text>
        </View>

        <View style={styles.actionBar} testID="quote-actions">
          <Pressable testID="q-like" onPress={toggleLike} style={styles.action}>
            <Feather name="heart" size={20} color={(quote as any).liked_by_me ? '#B3552F' : colors.espresso} />
            <Text style={[styles.actionCount, (quote as any).liked_by_me && { color: '#B3552F' }]}>{(quote as any).likes_count || 0}</Text>
          </Pressable>
          <Pressable testID="q-comments" onPress={() => (comments === null ? loadComments() : setComments(null))} style={styles.action}>
            <Feather name="message-circle" size={20} color={colors.espresso} />
            <Text style={styles.actionCount}>{(quote as any).comments_count || 0}</Text>
          </Pressable>
          <Pressable testID="q-share" onPress={shareImage} style={styles.action}>
            <Feather name="share" size={20} color={colors.espresso} />
          </Pressable>
          <Pressable testID="q-save" onPress={openPin} style={[styles.action, styles.actionSave]}>
            <Feather name="bookmark" size={16} color={colors.creme} />
            <Text style={styles.actionSaveText}>{t('Épingler')}</Text>
          </Pressable>
        </View>

        {comments !== null && (
          <View style={styles.commentsBox} testID="quote-comments">
            {comments.length === 0 && <Text style={styles.commentEmpty}>{t('Sois la première à laisser un mot.')}</Text>}
            {comments.map((c: any) => (
              <View key={c.comment_id} style={styles.comment} testID={`comment-${c.comment_id}`}>
                {c.author?.picture ? <Image source={{ uri: c.author.picture }} style={styles.commentAvatar} /> : <View style={styles.commentAvatar}><Text style={styles.commentInitial}>{(c.author?.pseudo?.[0] || 'M').toUpperCase()}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentAuthor}>{c.author?.pseudo}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
                {(c.is_mine || quote.is_owner) && (
                  <Pressable testID={`comment-delete-${c.comment_id}`} onPress={() => deleteComment(c.comment_id)} hitSlop={8}><Feather name="x" size={14} color={colors.clay} /></Pressable>
                )}
              </View>
            ))}
            <View style={styles.commentRow}>
              <TextInput testID="comment-input" value={comment} onChangeText={setComment} placeholder={t('Laisser un mot…')} placeholderTextColor={colors.clay} style={styles.commentInput} maxLength={600} multiline />
              <Pressable testID="comment-send" onPress={sendComment} disabled={!comment.trim() || sendingComment} style={[styles.commentSend, (!comment.trim() || sendingComment) && { opacity: 0.4 }]}>
                <Feather name="send" size={16} color={colors.creme} />
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.label}>{t('Style de partage')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['papier','encre','glacier'] as const).map(s => (
            <Pressable key={s} testID={`style-${s}`} onPress={() => setStyle(s)} style={[styles.styleChip, style === s && styles.styleChipActive]}>
              <Text style={[styles.styleText, style === s && { color: colors.creme }]}>{s === 'papier' ? t('Papier') : s === 'encre' ? t('Encre') : t('Glacier')}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: spacing.lg }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable testID="btn-save-image" onPress={saveToGallery} disabled={busy !== null} style={[styles.shareBtn, styles.shareBtnGhost]}>
            {busy === 'save' ? <ManentLoader size={20} /> : (
              <>
                <Feather name="download" size={16} color={colors.espresso} />
                <Text style={styles.shareBtnGhostText}>{t('Galerie')}</Text>
              </>
            )}
          </Pressable>
          <Pressable testID="btn-share-image" onPress={shareImage} disabled={busy !== null} style={styles.shareBtn}>
            {busy === 'share' ? <ManentLoader size={20} /> : (
              <>
                <Feather name="share" size={16} color={colors.creme} />
                <Text style={styles.shareBtnText}>{t('Partager l’image')}</Text>
              </>
            )}
          </Pressable>
        </View>
        {feedback ? <Text style={styles.feedback} testID="share-feedback">{feedback}</Text> : null}
        <View style={{ height: spacing.md }} />
        {quote.is_owner === false && quote.author?.handle ? (
          <Pressable
            testID="btn-view-author"
            onPress={() => router.push({ pathname: '/reader/[handle]', params: { handle: quote.author!.handle! } })}
            style={styles.authorRow}
          >
            <View style={styles.authorAvatar}><Text style={styles.authorInitial}>{(quote.author?.pseudo?.[0] || 'M').toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{quote.author?.pseudo}</Text>
              <Text style={styles.authorHandle}>{t('Voir le profil de @{handle}', { handle: quote.author?.handle || '' })}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>
        ) : null}
        <GhostButton title={t('Retour')} onPress={() => router.back()} />
      </ScrollView>

      {/* Rendu hors écran 1080×1350 pour l'export */}
      <View style={styles.offscreen}>
        <ShareQuoteCard ref={shareRef} quote={quote} variant={style} />
      </View>

      <Modal visible={pinning} transparent animationType="slide" onRequestClose={() => setPinning(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>{t('Choisis un tableau')}</Text>
            {boards.length === 0 ? (
              <Text style={{ fontFamily: fonts.body, color: colors.clay, textAlign: 'center', paddingVertical: spacing.xl }}>{t('Aucun tableau. Crée-en un depuis Communauté.')}</Text>
            ) : (
              <FlatList
                data={boards}
                keyExtractor={x => x.board_id}
                renderItem={({ item }) => (
                  <Pressable testID={`pin-target-${item.board_id}`} onPress={() => pinTo(item.board_id)} style={styles.boardRow}>
                    <Feather name="bookmark" size={18} color={colors.chambray} />
                    <Text style={styles.boardName}>{item.name}</Text>
                  </Pressable>
                )}
              />
            )}
            <GhostButton title={t('Fermer')} onPress={() => setPinning(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  card: { borderRadius: radius.md, padding: spacing.xl },
  mark: { fontFamily: fonts.displayMedium, fontSize: 80, lineHeight: 72, marginBottom: -14, marginLeft: -6 },
  text: { fontFamily: fonts.display, fontSize: 26, lineHeight: 36 },
  divider: { height: 1, opacity: 0.4, marginVertical: spacing.lg },
  source: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  authorLine: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  openBook: { fontFamily: fonts.bodyMedium, fontSize: 11, marginTop: 6, letterSpacing: 0.5 },
  pageNum: { fontFamily: fonts.displayMedium, fontSize: 44, lineHeight: 46 },
  pageLbl: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 2 },
  brand: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  styleChip: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  styleChipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  styleText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft },
  actionCount: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  actionSave: { marginLeft: 'auto', backgroundColor: colors.chambray, borderColor: colors.chambray },
  actionSaveText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  commentsBox: { marginTop: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  commentEmpty: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginBottom: spacing.sm },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: spacing.sm },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  commentInitial: { fontFamily: fonts.displayMedium, fontSize: 13, color: colors.espresso },
  commentAuthor: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.espresso },
  commentText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, lineHeight: 19 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: spacing.xs },
  commentInput: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.glacier, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.body, fontSize: 14, color: colors.espresso },
  commentSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { flex: 1.4, height: 52, borderRadius: radius.md, backgroundColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareBtnGhost: { flex: 1, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft },
  shareBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  shareBtnGhostText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  feedback: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  authorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  authorInitial: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  authorName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.espresso },
  authorHandle: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
  offscreen: { position: 'absolute', top: 0, left: -2000, pointerEvents: 'none' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.glacier, padding: spacing.xl, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  grabber: { width: 44, height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, marginBottom: spacing.md },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8 },
  boardName: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
});
