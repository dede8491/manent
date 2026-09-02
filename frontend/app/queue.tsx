import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { BookCover } from '@/src/components/BookCover';
import { BottomSheet } from '@/src/components/BottomSheet';
import ManentLoader from '@/src/components/ManentLoader';
import { useT } from '@/src/i18n';

type Book = { book_id: string; title: string; author?: string; cover?: string | null; pages?: number | null; queue_position?: number | null };

const ROW_H = 76;

// « Lecture suivante » : la file ordonnée des livres à lire, comme la file d'attente
// d'Apple Music. Le premier est mis en avant ; les suivants se réordonnent au doigt.
export default function QueueScreen() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<Book | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const booksRef = useRef<Book[]>([]);
  booksRef.current = books;

  const load = useCallback(async () => {
    try {
      const r = await api<{ books: Book[] }>('/books/queue');
      setBooks(r.books || []);
    } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const persist = async (next: Book[]) => {
    setBooks(next);
    try { await api('/books/queue', { method: 'PATCH', body: JSON.stringify({ book_ids: next.map(b => b.book_id) }) }); } catch { load(); }
  };

  const move = (from: number, to: number) => {
    const arr = [...booksRef.current];
    const [item] = arr.splice(from, 1);
    arr.splice(Math.max(0, Math.min(arr.length, to)), 0, item);
    persist(arr);
  };

  const startNow = async (b: Book) => {
    setMenuFor(null);
    router.push({ pathname: '/book/[id]', params: { id: b.book_id } });
  };

  const remove = async (b: Book) => {
    setMenuFor(null);
    const next = booksRef.current.filter(x => x.book_id !== b.book_id);
    setBooks(next);
    try { await api(`/books/${b.book_id}`, { method: 'DELETE' }); } catch { load(); }
  };

  // Glisser-déposer : la ligne suit le doigt, la cible est déduite du déplacement.
  const makePan = (index: number) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
    onPanResponderGrant: () => {
      setDragIndex(index);
      dragY.setValue(0);
      Haptics.selectionAsync().catch(() => {});
    },
    onPanResponderMove: (_, g) => dragY.setValue(g.dy),
    onPanResponderRelease: (_, g) => {
      const delta = Math.round(g.dy / ROW_H);
      setDragIndex(null);
      dragY.setValue(0);
      if (delta !== 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        // index dans la liste complète = index + 1 (le premier est la vedette)
        move(index + 1, index + 1 + delta);
      }
    },
    onPanResponderTerminate: () => { setDragIndex(null); dragY.setValue(0); },
  });

  const first = books[0];
  const rest = books.slice(1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-queue">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="queue-back" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.headerLabel}>{t('Liste de lecture')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}><ManentLoader size={48} /></View>
      ) : books.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={styles.emptyTitle}>{t('Ta file est vide.')}</Text>
          <Text style={styles.emptySub}>{t('Scanne un livre en librairie ou ajoute-le « à lire » : il prendra sa place ici.')}</Text>
          <Pressable testID="queue-scan" onPress={() => router.push('/discover/scan')} style={styles.emptyBtn}>
            <Feather name="maximize" size={15} color={colors.creme} />
            <Text style={styles.emptyBtnText}>{t('Scanner un livre')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }} scrollEnabled={dragIndex === null}>
          <Text style={styles.title}>{t('Lecture suivante')}</Text>
          <Text style={styles.sub}>{t(books.length > 1 ? '{n} livres t’attendent' : '{n} livre t’attend', { n: books.length })}</Text>

          {first && (
            <View style={styles.featured} testID="queue-first">
              <BookCover uri={first.cover} title={first.title} width={104} height={152} radius={10} initialSize={40} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={styles.featLabel}>{t('Ensuite')}</Text>
                <Text style={styles.featTitle} numberOfLines={3}>{first.title}</Text>
                {!!first.author && <Text style={styles.featAuthor} numberOfLines={1}>{first.author}</Text>}
                <Pressable testID="queue-start" onPress={() => startNow(first)} style={styles.startBtn}>
                  <Feather name="play" size={13} color={colors.creme} />
                  <Text style={styles.startText}>{t('Commencer')}</Text>
                </Pressable>
                <Pressable testID="queue-first-menu" onPress={() => setMenuFor(first)} hitSlop={8} style={{ marginTop: 8 }}>
                  <Text style={styles.link}>{t('Options')}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {rest.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{t('Puis, dans l’ordre')}</Text>
              <Text style={styles.hint}>{t('Maintiens la poignée et glisse pour réordonner.')}</Text>
              <View>
                {rest.map((b, i) => {
                  const dragging = dragIndex === i;
                  const pan = makePan(i);
                  return (
                    <Animated.View
                      key={b.book_id}
                      testID={`queue-row-${b.book_id}`}
                      style={[styles.row, dragging && styles.rowDragging, dragging && { transform: [{ translateY: dragY }], zIndex: 10 }]}
                    >
                      <Text style={styles.pos}>{i + 2}</Text>
                      <BookCover uri={b.cover} title={b.title} width={40} height={58} radius={5} initialSize={18} />
                      <Pressable style={{ flex: 1 }} onPress={() => setMenuFor(b)} testID={`queue-open-${b.book_id}`}>
                        <Text style={styles.rowTitle} numberOfLines={2}>{b.title}</Text>
                        {!!b.author && <Text style={styles.rowAuthor} numberOfLines={1}>{b.author}</Text>}
                      </Pressable>
                      <View {...pan.panHandlers} style={styles.handle} testID={`queue-handle-${b.book_id}`}>
                        <Feather name="menu" size={18} color={colors.clay} />
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.title || ''} subtitle={menuFor?.author || undefined} testID="sheet-queue-menu">
        {menuFor && (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Pressable testID="queue-menu-start" onPress={() => startNow(menuFor)} style={styles.menuRow}>
              <Feather name="play" size={17} color={colors.chambray} /><Text style={styles.menuText}>{t('Lire maintenant')}</Text>
            </Pressable>
            {books.indexOf(menuFor) > 0 && (
              <Pressable testID="queue-menu-top" onPress={() => { setMenuFor(null); move(books.indexOf(menuFor), 0); }} style={styles.menuRow}>
                <Feather name="arrow-up" size={17} color={colors.chambray} /><Text style={styles.menuText}>{t('Monter en tête')}</Text>
              </Pressable>
            )}
            <Pressable testID="queue-menu-open" onPress={() => { setMenuFor(null); router.push({ pathname: '/book/[id]', params: { id: menuFor.book_id } }); }} style={styles.menuRow}>
              <Feather name="book-open" size={17} color={colors.chambray} /><Text style={styles.menuText}>{t('Voir la fiche')}</Text>
            </Pressable>
            <Pressable testID="queue-menu-remove" onPress={() => remove(menuFor)} style={styles.menuRow}>
              <Feather name="trash-2" size={17} color={colors.clay} /><Text style={[styles.menuText, { color: colors.clay }]}>{t('Retirer de ma bibliothèque')}</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2, marginBottom: spacing.lg },
  featured: { flexDirection: 'row', gap: spacing.lg, backgroundColor: colors.bisque, borderRadius: radius.lg, padding: spacing.lg },
  featLabel: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.chambray, letterSpacing: 1.5, textTransform: 'uppercase' },
  featTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, lineHeight: 26, marginTop: 2 },
  featAuthor: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: 2 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 36, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.chambray, marginTop: spacing.md },
  startText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  link: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, textDecorationLine: 'underline' },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.xl },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2, marginBottom: spacing.sm },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: spacing.md, marginBottom: 6 },
  rowDragging: { borderColor: colors.chambray, shadowColor: '#3A2119', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  pos: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.clay, width: 18, textAlign: 'center' },
  rowTitle: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.espresso, lineHeight: 19 },
  rowAuthor: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 1 },
  handle: { width: 40, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 50, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  menuText: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.espresso },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.chambray, marginTop: spacing.lg },
  emptyBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
});
