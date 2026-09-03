import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';

type Q = {
  quote_id: string; text: string; page?: number; themes?: string[];
  is_public?: boolean; is_hidden?: boolean; created_at?: string;
  book_id?: string; book?: { title?: string } | null;
};

type VisFilter = 'toutes' | 'publiques' | 'privees' | 'masquees';

export function QuotesManager({ initialBookId }: { initialBookId?: string | null } = {}) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [quotes, setQuotes] = useState<Q[]>([]);
  const [search, setSearch] = useState('');
  const [vis, setVis] = useState<VisFilter>('toutes');
  const [bookFilter, setBookFilter] = useState<string | null>(initialBookId || null);
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [grid, setGrid] = useState(false);
  const [menuFor, setMenuFor] = useState<Q | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Q[]>([]);
  const undoTimer = useRef<any>(null);

  const load = useCallback(async () => {
    try { const r = await api<{ quotes: Q[] }>('/quotes'); setQuotes(r.quotes); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pendingIds = useMemo(() => new Set(pendingDelete.map(q => q.quote_id)), [pendingDelete]);

  const books = useMemo(() => {
    const m = new Map<string, string>();
    quotes.forEach(q => { if (q.book_id && q.book?.title) m.set(q.book_id, q.book.title); });
    return [...m.entries()];
  }, [quotes]);
  const themes = useMemo(() => [...new Set(quotes.flatMap(q => q.themes || []))].slice(0, 12), [quotes]);

  const counts = useMemo(() => ({
    pub: quotes.filter(q => q.is_public && !q.is_hidden).length,
    priv: quotes.filter(q => !q.is_public && !q.is_hidden).length,
    hidden: quotes.filter(q => q.is_hidden).length,
  }), [quotes]);

  const shown = useMemo(() => quotes.filter(q => {
    if (pendingIds.has(q.quote_id)) return false;
    if (vis === 'publiques' && (!q.is_public || q.is_hidden)) return false;
    if (vis === 'privees' && (q.is_public || q.is_hidden)) return false;
    if (vis === 'masquees' && !q.is_hidden) return false;
    if (bookFilter && q.book_id !== bookFilter) return false;
    if (themeFilter && !(q.themes || []).includes(themeFilter)) return false;
    if (search.trim() && !q.text.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [quotes, vis, bookFilter, themeFilter, search, pendingIds]);

  const patchLocal = (ids: string[], patch: Partial<Q>) =>
    setQuotes(prev => prev.map(q => ids.includes(q.quote_id) ? { ...q, ...patch } : q));

  const applyAction = async (ids: string[], action: 'hide' | 'show' | 'public' | 'private') => {
    patchLocal(ids, action === 'hide' ? { is_hidden: true } : action === 'show' ? { is_hidden: false } : action === 'public' ? { is_public: true } : { is_public: false });
    setMenuFor(null); setSelected(new Set());
    try { await api('/quotes/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }); } catch { load(); }
  };

  // Suppression avec annulation pendant 5 secondes
  const startDelete = (items: Q[]) => {
    if (undoTimer.current) { clearTimeout(undoTimer.current); commitDelete(); }
    setPendingDelete(items);
    setMenuFor(null); setSelected(new Set());
    undoTimer.current = setTimeout(() => commitDeleteRef.current(), 5000);
  };
  const commitDelete = async () => {
    undoTimer.current = null;
    setPendingDelete(cur => {
      if (cur.length) {
        api('/quotes/bulk', { method: 'POST', body: JSON.stringify({ ids: cur.map(q => q.quote_id), action: 'delete' }) })
          .then(() => load()).catch(() => load());
      }
      return [];
    });
  };
  const commitDeleteRef = useRef(commitDelete);
  commitDeleteRef.current = commitDelete;
  const undoDelete = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setPendingDelete([]);
  };

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selMode = selected.size > 0;
  const selIds = [...selected];

  const badge = (q: Q) => q.is_hidden
    ? { label: t('Masquée'), color: colors.clay, bg: colors.borderSoft }
    : q.is_public
      ? { label: t('Publique'), color: colors.creme, bg: colors.chambray }
      : { label: t('Privée'), color: colors.creme, bg: colors.clay };

  const QuoteRow = ({ q }: { q: Q }) => {
    const b = badge(q);
    const isSel = selected.has(q.quote_id);
    return (
      <Pressable
        testID={`mq-${q.quote_id}`}
        onPress={() => selMode ? toggleSelect(q.quote_id) : router.push({ pathname: '/quote/[id]', params: { id: q.quote_id } })}
        onLongPress={() => toggleSelect(q.quote_id)}
        style={[styles.row, grid && styles.cardGrid, isSel && styles.rowSelected]}
      >
        {selMode && (
          <View style={[styles.checkbox, isSel && { backgroundColor: colors.chambray, borderColor: colors.chambray }]}>
            {isSel && <Feather name="check" size={12} color={colors.creme} />}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.quoteText} numberOfLines={grid ? 5 : 3}>&ldquo; {q.text}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: b.bg }]}><Text style={[styles.badgeText, { color: b.color }]}>{b.label}</Text></View>
            {q.book?.title ? <Text style={styles.metaText} numberOfLines={1}>{q.book.title}{q.page ? ` · p. ${q.page}` : ''}</Text> : null}
          </View>
        </View>
        {!selMode && (
          <Pressable testID={`mq-menu-${q.quote_id}`} onPress={() => setMenuFor(q)} hitSlop={10} style={styles.dots}>
            <Feather name="more-horizontal" size={18} color={colors.clay} />
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }} testID="quotes-manager">
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Feather name="search" size={15} color={colors.clay} />
          <TextInput testID="mq-search" value={search} onChangeText={setSearch} placeholder={t('Chercher dans tes citations…')} placeholderTextColor={colors.clay} style={styles.searchInput} />
        </View>
        <Pressable testID="mq-toggle-grid" onPress={() => setGrid(v => !v)} style={styles.gridBtn}>
          <Feather name={grid ? 'list' : 'grid'} size={17} color={colors.espresso} />
        </Pressable>
      </View>
      <Text style={styles.countsBanner} testID="mq-counts">
        {t('{pub} publiques · {priv} privées · {hidden} masquées', { pub: counts.pub, priv: counts.priv, hidden: counts.hidden })}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={{ flexGrow: 0 }}>
        {([['toutes', 'Toutes'], ['publiques', 'Publiques'], ['privees', 'Privées'], ['masquees', 'Masquées']] as [VisFilter, string][]).map(([v, lbl]) => (
          <Pressable key={v} testID={`mq-vis-${v}`} onPress={() => setVis(v)} style={[styles.chip, vis === v && styles.chipActive]}>
            <Text style={[styles.chipText, vis === v && styles.chipTextActive]}>{t(lbl)}</Text>
          </Pressable>
        ))}
        {books.map(([id, title]) => (
          <Pressable key={id} onPress={() => setBookFilter(bookFilter === id ? null : id)} style={[styles.chip, bookFilter === id && styles.chipActive]}>
            <Text style={[styles.chipText, bookFilter === id && styles.chipTextActive]} numberOfLines={1}>{title}</Text>
          </Pressable>
        ))}
        {themes.map(th => (
          <Pressable key={th} onPress={() => setThemeFilter(themeFilter === th ? null : th)} style={[styles.chip, themeFilter === th && styles.chipActive]}>
            <Text style={[styles.chipText, themeFilter === th && styles.chipTextActive]}>{th}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.md, paddingBottom: 140 }}>
        {shown.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Text style={styles.emptyTitle}>{quotes.length === 0 ? t('Photographie ta première citation.') : t('Rien ne correspond à ces filtres.')}</Text>
            {quotes.length === 0 && (
              <>
                <Pressable testID="mq-empty-capture" onPress={() => router.push('/capture?mode=camera' as any)} style={styles.captureBtn}>
                  <Feather name="camera" size={15} color={colors.creme} />
                  <Text style={styles.captureBtnText}>{t('Photographier')}</Text>
                </Pressable>
                <Pressable testID="mq-empty-write" onPress={() => router.push('/capture?mode=write' as any)} hitSlop={8} style={{ marginTop: spacing.sm }}>
                  <Text style={styles.writeLink}>{t('ou écris-la')}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : grid ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.md }}>{shown.filter((_, i) => i % 2 === 0).map(q => <QuoteRow key={q.quote_id} q={q} />)}</View>
            <View style={{ flex: 1, gap: spacing.md }}>{shown.filter((_, i) => i % 2 === 1).map(q => <QuoteRow key={q.quote_id} q={q} />)}</View>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>{shown.map(q => <QuoteRow key={q.quote_id} q={q} />)}</View>
        )}
      </ScrollView>

      {selMode && (
        <View style={styles.bulkBar} testID="mq-bulk-bar">
          <Text style={styles.bulkCount}>{selected.size}</Text>
          <Pressable testID="mq-bulk-public" onPress={() => applyAction(selIds, 'public')} style={styles.bulkBtn}><Feather name="globe" size={16} color={colors.creme} /></Pressable>
          <Pressable testID="mq-bulk-private" onPress={() => applyAction(selIds, 'private')} style={styles.bulkBtn}><Feather name="lock" size={16} color={colors.creme} /></Pressable>
          <Pressable testID="mq-bulk-hide" onPress={() => applyAction(selIds, 'hide')} style={styles.bulkBtn}><Feather name="eye-off" size={16} color={colors.creme} /></Pressable>
          <Pressable testID="mq-bulk-delete" onPress={() => startDelete(quotes.filter(q => selected.has(q.quote_id)))} style={[styles.bulkBtn, { backgroundColor: '#B3552F' }]}><Feather name="trash-2" size={16} color={colors.creme} /></Pressable>
          <Pressable testID="mq-bulk-cancel" onPress={() => setSelected(new Set())} style={styles.bulkGhost}><Text style={styles.bulkGhostText}>{t('Annuler')}</Text></Pressable>
        </View>
      )}

      {pendingDelete.length > 0 && (
        <View style={styles.undoBar} testID="mq-undo-bar">
          <Text style={styles.undoText}>{t(pendingDelete.length > 1 ? '{n} citations supprimées' : 'Citation supprimée', { n: pendingDelete.length })}</Text>
          <Pressable testID="mq-undo" onPress={undoDelete} hitSlop={8}><Text style={styles.undoBtn}>{t('Annuler')}</Text></Pressable>
        </View>
      )}

      <Modal visible={menuFor !== null} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuFor(null)}>
          <View style={styles.menu}>
            {menuFor && (
              <>
                <Pressable testID="mq-action-edit" onPress={() => { setMenuFor(null); router.push({ pathname: '/quote/[id]', params: { id: menuFor.quote_id } }); }} style={styles.menuRow}>
                  <Feather name="edit-3" size={16} color={colors.espresso} /><Text style={styles.menuText}>{t('Modifier')}</Text>
                </Pressable>
                <Pressable testID="mq-action-vis" onPress={() => applyAction([menuFor.quote_id], menuFor.is_public ? 'private' : 'public')} style={styles.menuRow}>
                  <Feather name={menuFor.is_public ? 'lock' : 'globe'} size={16} color={colors.espresso} /><Text style={styles.menuText}>{menuFor.is_public ? t('Rendre privée') : t('Rendre publique')}</Text>
                </Pressable>
                <Pressable testID="mq-action-hide" onPress={() => applyAction([menuFor.quote_id], menuFor.is_hidden ? 'show' : 'hide')} style={styles.menuRow}>
                  <Feather name={menuFor.is_hidden ? 'eye' : 'eye-off'} size={16} color={colors.espresso} /><Text style={styles.menuText}>{menuFor.is_hidden ? t('Afficher') : t('Masquer')}</Text>
                </Pressable>
                <Pressable testID="mq-action-delete" onPress={() => startDelete([menuFor])} style={styles.menuRow}>
                  <Feather name="trash-2" size={16} color="#B3552F" /><Text style={[styles.menuText, { color: '#B3552F' }]}>{t('Supprimer')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xl, alignItems: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: spacing.md, backgroundColor: colors.creme, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.espresso, paddingVertical: 0 },
  gridBtn: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.creme, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  countsBanner: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  chipScroll: { gap: 8, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  chip: { height: 32, paddingHorizontal: 12, maxWidth: 160, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.espresso },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.bisque, borderRadius: 16, padding: spacing.md },
  cardGrid: { flexDirection: 'column' },
  rowSelected: { borderWidth: 2, borderColor: colors.chambray },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.clay, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  quoteText: { fontFamily: fonts.display, fontSize: 15, color: colors.espresso, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.bodyMedium, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  metaText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.clay, letterSpacing: 0.5, textTransform: 'uppercase' },
  dots: { padding: 2 },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, textAlign: 'center' },
  captureBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.chambray, marginTop: spacing.lg },
  captureBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.creme },
  writeLink: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, textDecorationLine: 'underline' },
  bulkBar: { position: 'absolute', bottom: 90, left: spacing.xl, right: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.espresso, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 54 },
  bulkCount: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.creme, marginRight: 2 },
  bulkBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  bulkGhost: { flex: 1, alignItems: 'flex-end' },
  bulkGhostText: { fontFamily: fonts.body, fontSize: 13, color: colors.creme, textDecorationLine: 'underline' },
  undoBar: { position: 'absolute', bottom: 90, left: spacing.xl, right: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.espresso, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 50 },
  undoText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.creme },
  undoBtn: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: '#A9CAE2', textDecorationLine: 'underline' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.35)', justifyContent: 'center', padding: spacing.xxl },
  menu: { backgroundColor: colors.creme, borderRadius: 16, paddingVertical: spacing.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, height: 50 },
  menuText: { fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
});
