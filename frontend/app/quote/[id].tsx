import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, FlatList, Platform, Alert, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { ShareQuoteCard } from '@/src/components/ShareQuoteCard';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';
import { PrimaryButton, GhostButton } from '@/src/components/Button';

export default function QuoteDetail() {
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
      'Accès aux photos',
      "Pour enregistrer ta quote card, autorise l'accès aux photos dans les réglages.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings() },
      ],
    );
  };

  const ensureMediaPermission = async (): Promise<boolean> => {
    const current = await MediaLibrary.getPermissionsAsync(true);
    if (current.granted) return true;
    if (!current.canAskAgain) { openSettingsAlert(); return false; }
    const proceed = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Enregistrer dans ta galerie',
        "Manent enregistre ta quote card dans tes photos pour la partager facilement.",
        [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continuer', onPress: () => resolve(true) },
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
      if (Platform.OS === 'web') {
        const uri = await capture();
        downloadWeb(uri);
        setFeedback('Image téléchargée.');
      } else {
        const ok = await ensureMediaPermission();
        if (!ok) return;
        const uri = await capture();
        await MediaLibrary.saveToLibraryAsync(uri);
        setFeedback('Enregistrée dans ta galerie.');
      }
    } catch (e) {
      console.error('capture/save failed', e);
      setFeedback("Impossible de générer l'image. Réessaie.");
    } finally { setBusy(null); }
  };

  const shareImage = async () => {
    setFeedback('');
    setBusy('share');
    try {
      const uri = await capture();
      if (Platform.OS === 'web') {
        try {
          const blob = await (await fetch(uri)).blob();
          const file = new File([blob], 'manent-citation.png', { type: 'image/png' });
          const nav: any = navigator;
          if (nav.canShare && nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], title: 'Manent' });
          } else {
            downloadWeb(uri);
            setFeedback('Image téléchargée — partage-la sur Instagram ou WhatsApp.');
          }
        } catch {
          downloadWeb(uri);
          setFeedback('Image téléchargée — partage-la sur Instagram ou WhatsApp.');
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Partager la citation' });
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
        <Text style={styles.h1}>Citation</Text>
        {quote.is_owner !== false ? (
          <Pressable onPress={del} testID="q-delete" style={styles.iconBtn}><Feather name="trash-2" size={20} color={colors.espresso} /></Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={[styles.card, { backgroundColor: bg }]} testID="quote-card-hero">
          <Text style={[styles.mark, { color: style === 'encre' ? colors.chambray : colors.chambray }]}>&ldquo;</Text>
          <Text style={[styles.text, { color: fg }]}>{quote.text}</Text>
          <View style={[styles.divider, { backgroundColor: style === 'encre' ? colors.clay : colors.borderSoft }]} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.source, { color: style === 'encre' ? colors.creme : colors.clay }]}>{quote.book?.title || 'SANS TITRE'}</Text>
              {!!quote.book?.author && <Text style={[styles.authorLine, { color: style === 'encre' ? colors.creme : colors.clay }]}>{quote.book.author}</Text>}
            </View>
            {(quote.page || quote.chapter) ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.pageNum, { color: fg }]}>{quote.page || quote.chapter}</Text>
                <Text style={[styles.pageLbl, { color: style === 'encre' ? colors.creme : colors.clay }]}>{quote.book?.type === 'wattpad' ? 'CHAP.' : 'PAGE'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.brand, { color: style === 'encre' ? colors.creme : colors.clay }]}>Manent · @{quote.author?.handle}</Text>
        </View>

        <Text style={styles.label}>Style de partage</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['papier','encre','glacier'] as const).map(s => (
            <Pressable key={s} testID={`style-${s}`} onPress={() => setStyle(s)} style={[styles.styleChip, style === s && styles.styleChipActive]}>
              <Text style={[styles.styleText, style === s && { color: colors.creme }]}>{s === 'papier' ? 'Papier' : s === 'encre' ? 'Encre' : 'Glacier'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: spacing.lg }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable testID="btn-save-image" onPress={saveToGallery} disabled={busy !== null} style={[styles.shareBtn, styles.shareBtnGhost]}>
            {busy === 'save' ? <ActivityIndicator size="small" color={colors.espresso} /> : (
              <>
                <Feather name="download" size={16} color={colors.espresso} />
                <Text style={styles.shareBtnGhostText}>Galerie</Text>
              </>
            )}
          </Pressable>
          <Pressable testID="btn-share-image" onPress={shareImage} disabled={busy !== null} style={styles.shareBtn}>
            {busy === 'share' ? <ActivityIndicator size="small" color={colors.creme} /> : (
              <>
                <Feather name="share" size={16} color={colors.creme} />
                <Text style={styles.shareBtnText}>Partager l&rsquo;image</Text>
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
              <Text style={styles.authorHandle}>Voir le profil de @{quote.author?.handle}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.clay} />
          </Pressable>
        ) : (
          <PrimaryButton testID="btn-pin" title="Épingler sur un tableau" onPress={openPin} />
        )}
        <GhostButton title="Retour" onPress={() => router.back()} />
      </ScrollView>

      {/* Rendu hors écran 1080×1350 pour l'export */}
      <View style={styles.offscreen}>
        <ShareQuoteCard ref={shareRef} quote={quote} variant={style} />
      </View>

      <Modal visible={pinning} transparent animationType="slide" onRequestClose={() => setPinning(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>Choisis un tableau</Text>
            {boards.length === 0 ? (
              <Text style={{ fontFamily: fonts.body, color: colors.clay, textAlign: 'center', paddingVertical: spacing.xl }}>Aucun tableau. Crée-en un depuis Communauté.</Text>
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
            <GhostButton title="Fermer" onPress={() => setPinning(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  card: { borderRadius: radius.md, padding: spacing.xl },
  mark: { fontFamily: fonts.displayMedium, fontSize: 80, lineHeight: 72, marginBottom: -14, marginLeft: -6 },
  text: { fontFamily: fonts.display, fontSize: 26, lineHeight: 36 },
  divider: { height: 1, opacity: 0.4, marginVertical: spacing.lg },
  source: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  authorLine: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  pageNum: { fontFamily: fonts.displayMedium, fontSize: 44, lineHeight: 46 },
  pageLbl: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 2 },
  brand: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  styleChip: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme },
  styleChipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  styleText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
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
