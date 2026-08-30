import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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

  if (!quote) return <View style={{ flex: 1, backgroundColor: colors.glacier }} />;

  const bg = style === 'encre' ? colors.espresso : style === 'glacier' ? colors.glacier : colors.bisque;
  const fg = style === 'encre' ? colors.creme : colors.espresso;

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-quote-detail">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="q-back" style={styles.iconBtn}><Feather name="chevron-left" size={22} color={colors.espresso} /></Pressable>
        <Text style={styles.h1}>Citation</Text>
        <Pressable onPress={del} testID="q-delete" style={styles.iconBtn}><Feather name="trash-2" size={20} color={colors.espresso} /></Pressable>
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
        <PrimaryButton testID="btn-pin" title="Épingler sur un tableau" onPress={openPin} />
        <GhostButton title="Retour" onPress={() => router.back()} />
      </ScrollView>

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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.glacier, padding: spacing.xl, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  grabber: { width: 44, height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, marginBottom: spacing.md },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8 },
  boardName: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
});
