import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import { BookCover } from '@/src/components/BookCover';
import { BottomSheet } from '@/src/components/BottomSheet';
import { Toast } from '@/src/components/Toast';
import ManentLoader from '@/src/components/ManentLoader';
import { Draft, Entry, MOODS, Prompt, loadDraft, localDateKey, newClientId, saveDraft, submitEntry } from '@/src/journal';

type Book = { book_id: string; title: string; author?: string; cover?: string | null; type?: string; pages?: number; chapters?: number; progress_page?: number; progress_chapter?: number; status?: string };

// Écran central de la V1 : écrire une entrée de journal (2 taps depuis l'accueil).
// Livre présélectionné, page atteinte, humeur, prompt ignorable, texte, citations rattachées, publication optionnelle.
// Brouillon sauvegardé localement en continu ; envoi hors ligne mis en file (voir src/journal.ts).
export default function JournalNew() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ book_id?: string; page?: string; quote_id?: string; entry_id?: string; from?: string }>();
  const editing = !!params.entry_id;

  const [books, setBooks] = useState<Book[] | null>(null);
  const [bookId, setBookId] = useState<string>(params.book_id || '');
  const [page, setPage] = useState<string>(params.page || '');
  const [mood, setMood] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [quoteIds, setQuoteIds] = useState<string[]>(params.quote_id ? [params.quote_id] : []);
  const [isPublic, setIsPublic] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptIdx, setPromptIdx] = useState(0);
  const [promptHidden, setPromptHidden] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteSheet, setQuoteSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limitSheet, setLimitSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const clientId = useRef(newClientId());
  const inputRef = useRef<TextInput>(null);

  const book = useMemo(() => (books || []).find(b => b.book_id === bookId) || null, [books, bookId]);
  const unit = book?.type === 'wattpad' ? 'chapitre' : 'page';
  const prompt = !promptHidden && prompts.length ? prompts[promptIdx % prompts.length] : null;

  // Chargement : livres, prompts (le « suivant » d'abord), entrée à modifier ou brouillon
  useEffect(() => {
    (async () => {
      let list: Book[] = [];
      try {
        const r = await api<{ books: Book[] }>('/books');
        list = (r.books || []).filter(b => b.status !== 'termine' || b.book_id === params.book_id);
        list.sort((a: any, b: any) => (a.status === 'en_cours' ? 0 : 1) - (b.status === 'en_cours' ? 0 : 1) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
        setBooks(list);
      } catch { setBooks([]); }
      try {
        const [all, next] = await Promise.all([api<{ prompts: Prompt[] }>('/journal/prompts'), api<{ prompt: Prompt | null }>('/journal/prompts/next')]);
        const ps = all.prompts || [];
        setPrompts(ps);
        const i = ps.findIndex(p => p.prompt_id === next.prompt?.prompt_id);
        if (i >= 0) setPromptIdx(i);
      } catch {}
      if (params.entry_id) {
        try {
          const e = await api<Entry>(`/journal/entries/${params.entry_id}`);
          setBookId(e.book_id); setPage(String(e.page ?? e.chapter ?? '')); setMood(e.mood ?? null); setContent(e.content || '');
          setQuoteIds(e.quote_ids || []); setIsPublic(!!e.is_public); setPromptHidden(!e.prompt_text);
        } catch {}
      } else {
        const d = await loadDraft();
        if (d && (d.content || d.mood || d.quote_ids.length) && (!params.book_id || d.book_id === params.book_id)) {
          clientId.current = d.client_id;
          setBookId(d.book_id); setPage(d.page != null ? String(d.page) : (d.chapter != null ? String(d.chapter) : params.page || ''));
          setMood(d.mood ?? null); setContent(d.content); setQuoteIds(params.quote_id ? Array.from(new Set([...d.quote_ids, params.quote_id])) : d.quote_ids);
          setIsPublic(d.is_public); setRestored(true);
        } else if (!params.book_id) {
          const cur = list.find(b => b.status === 'en_cours');
          if (cur) setBookId(cur.book_id);
        }
      }
      setReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page par défaut : la progression actuelle du livre
  useEffect(() => {
    if (!book || page || params.page) return;
    const cur = book.type === 'wattpad' ? book.progress_chapter : book.progress_page;
    if (cur) setPage(String(cur));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.book_id]);

  // Citations du livre (pour en rattacher)
  useEffect(() => {
    if (!bookId) { setQuotes([]); return; }
    api<any>(`/quotes?book_id=${bookId}`).then(r => setQuotes(Array.isArray(r) ? r : r.quotes || [])).catch(() => setQuotes([]));
  }, [bookId]);

  const draft = useCallback((): Draft => ({
    client_id: clientId.current, book_id: bookId, date: localDateKey(),
    page: unit === 'page' && page ? parseInt(page, 10) || null : null,
    chapter: unit === 'chapitre' && page ? parseInt(page, 10) || null : null,
    content: content.trim(), mood, quote_ids: quoteIds, prompt_id: prompt?.prompt_id || null, prompt_text: prompt?.text || null, is_public: isPublic,
  }), [bookId, page, unit, content, mood, quoteIds, prompt, isPublic]);

  // Brouillon local, sauvegardé en continu (sauf en modification)
  useEffect(() => {
    if (!ready || editing) return;
    const h = setTimeout(() => { const d = draft(); saveDraft(d.content || d.mood || d.quote_ids.length ? d : null); }, 400);
    return () => clearTimeout(h);
  }, [draft, ready, editing]);

  const canSave = !!bookId && (content.trim().length > 0 || !!mood || quoteIds.length > 0) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const d = draft();
    try {
      if (editing) {
        await api(`/journal/entries/${params.entry_id}`, { method: 'PATCH', body: JSON.stringify({ page: d.page, chapter: d.chapter, content: d.content, mood: d.mood, quote_ids: d.quote_ids, is_public: d.is_public }) });
        router.back();
        return;
      }
      const r = await submitEntry(d);
      await saveDraft(null);
      if (r.queued) {
        setToast(t('Entrée gardée hors ligne. Elle partira au retour du réseau.'));
        setTimeout(() => router.back(), 1400);
      } else {
        router.replace({ pathname: '/journal/[id]', params: { id: r.entry!.entry_id, saved: '1' } });
      }
    } catch (e: any) {
      if (e?.status === 402) setLimitSheet(true);
      else setToast(t('Enregistrement impossible. Réessaie.'));
    } finally { setSaving(false); }
  };

  const toggleQuote = (id: string) => setQuoteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const attached = quotes.filter(q => quoteIds.includes(q.quote_id));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.glacier }}>
      <View style={{ flex: 1 }} testID="screen-journal-new">
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} testID="journal-new-close" style={styles.iconBtn} hitSlop={8}>
            <Feather name="x" size={22} color={colors.espresso} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.h1}>{editing ? t('Modifier l’entrée') : t('Entrée du jour')}</Text>
            <Text style={styles.dateLabel}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <Pressable onPress={save} disabled={!canSave} testID="journal-new-save" style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}>
            {saving ? <ManentLoader size={18} variant="sombre" /> : <Text style={styles.saveText}>{t('Enregistrer')}</Text>}
          </Pressable>
        </View>

        {!ready ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ManentLoader size={56} /></View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
            {restored && <Text style={styles.restored}>{t('Brouillon restauré.')}</Text>}

            {/* Livre */}
            {book ? (
              <Pressable testID="journal-new-book" onPress={() => !params.book_id && !editing && setBookId('')} style={styles.bookRow}>
                <BookCover uri={book.cover || undefined} title={book.title} width={40} height={56} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
                  {!!book.author && <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>}
                </View>
                {!params.book_id && !editing && <Feather name="chevron-down" size={16} color={colors.clay} />}
              </Pressable>
            ) : (books || []).length === 0 ? (
              <View style={styles.noBook} testID="journal-new-nobook">
                <Text style={styles.noBookTitle}>{t('Aucun livre en cours.')}</Text>
                <Text style={styles.noBookSub}>{t('Ajoute le livre que tu lis pour commencer ton journal.')}</Text>
                <Pressable testID="journal-new-addbook" onPress={() => router.push('/book/add')} style={styles.ghostBtn}>
                  <Feather name="plus" size={14} color={colors.espresso} /><Text style={styles.ghostText}>{t('Ajouter un livre')}</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.label}>{t('Quel livre ?')}</Text>
                {(books || []).slice(0, 8).map(b => (
                  <Pressable key={b.book_id} testID={`journal-new-pick-${b.book_id}`} onPress={() => setBookId(b.book_id)} style={styles.bookRow}>
                    <BookCover uri={b.cover || undefined} title={b.title} width={34} height={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookTitle} numberOfLines={1}>{b.title}</Text>
                      <Text style={styles.bookAuthor} numberOfLines={1}>{b.status === 'en_cours' ? t('En cours') : t('À lire')}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {!!book && (
              <>
                {/* Page atteinte */}
                <View style={styles.pageRow}>
                  <Text style={styles.label}>{unit === 'chapitre' ? t('Chapitre atteint') : t('Page atteinte')}</Text>
                  <TextInput testID="journal-new-page" value={page} onChangeText={v => setPage(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder={unit === 'chapitre' ? '12' : '142'} placeholderTextColor={colors.clay} style={styles.pageInput} />
                  {!!(book.type === 'wattpad' ? book.chapters : book.pages) && <Text style={styles.pageTotal}>/ {book.type === 'wattpad' ? book.chapters : book.pages}</Text>}
                </View>

                {/* Humeur */}
                <Text style={styles.label}>{t('Humeur de lecture')}</Text>
                <View style={styles.moodRow}>
                  {MOODS.map(m => {
                    const on = mood === m.value;
                    return (
                      <Pressable key={m.value} testID={`journal-new-mood-${m.value}`} onPress={() => setMood(on ? null : m.value)} style={[styles.moodBtn, on && { backgroundColor: m.color, borderColor: m.color }]}>
                        <View style={[styles.moodDot, { backgroundColor: on ? colors.creme : m.color }]} />
                        <Text style={[styles.moodText, on && { color: m.value >= 4 || m.value === 1 ? '#FFFFFF' : colors.espresso, fontFamily: fonts.bodyMedium }]}>{t(m.label)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Prompt guidé */}
                {prompt && !editing && (
                  <View style={styles.promptBox} testID="journal-new-prompt">
                    <Feather name="feather" size={14} color={colors.chambray} />
                    <Pressable style={{ flex: 1 }} onPress={() => inputRef.current?.focus()}>
                      <Text style={styles.promptText}>{prompt.text}</Text>
                    </Pressable>
                    <Pressable testID="journal-new-prompt-next" onPress={() => setPromptIdx(i => i + 1)} hitSlop={8}><Text style={styles.promptAction}>{t('Un autre')}</Text></Pressable>
                    <Pressable testID="journal-new-prompt-hide" onPress={() => setPromptHidden(true)} hitSlop={8}><Feather name="x" size={14} color={colors.clay} /></Pressable>
                  </View>
                )}

                {/* Texte */}
                <TextInput
                  ref={inputRef}
                  testID="journal-new-content"
                  value={content} onChangeText={setContent}
                  placeholder={t('Écris ce que tu as lu, ce que tu as ressenti…')} placeholderTextColor={colors.clay}
                  multiline textAlignVertical="top" style={styles.textarea}
                />

                {/* Citations rattachées */}
                {attached.map(q => (
                  <View key={q.quote_id} style={styles.quoteChip} testID={`journal-new-quote-${q.quote_id}`}>
                    <Text style={styles.quoteChipText} numberOfLines={2}>« {q.text} »</Text>
                    <Pressable onPress={() => toggleQuote(q.quote_id)} hitSlop={8}><Feather name="x" size={14} color={colors.clay} /></Pressable>
                  </View>
                ))}
                {quotes.length > 0 && (
                  <Pressable testID="journal-new-attach" onPress={() => setQuoteSheet(true)} style={styles.linkRow}>
                    <Feather name="paperclip" size={14} color={colors.chambray} />
                    <Text style={styles.linkText}>{attached.length ? t('Rattacher une autre citation') : t('Rattacher une citation de ce livre')}</Text>
                  </Pressable>
                )}
                <Pressable testID="journal-new-newquote" onPress={() => router.push({ pathname: '/capture', params: { book_id: bookId, mode: 'write' } })} style={styles.linkRow}>
                  <Feather name="plus" size={14} color={colors.chambray} />
                  <Text style={styles.linkText}>{t('Ajouter une citation')}</Text>
                </Pressable>

                {/* Visibilité */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>{t('Publier sur mon profil')}</Text>
                    <Text style={styles.switchSub}>{t('Par défaut, ton journal reste privé.')}</Text>
                  </View>
                  <Switch testID="journal-new-public" value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.chambray, false: colors.borderSoft }} thumbColor={colors.creme} />
                </View>
              </>
            )}
          </ScrollView>
        )}

        <BottomSheet visible={quoteSheet} onClose={() => setQuoteSheet(false)} title={t('Citations de ce livre')} testID="journal-new-quotes-sheet">
          {quotes.map(q => {
            const on = quoteIds.includes(q.quote_id);
            return (
              <Pressable key={q.quote_id} testID={`journal-new-pickquote-${q.quote_id}`} onPress={() => toggleQuote(q.quote_id)} style={styles.quoteRow}>
                <Feather name={on ? 'check-square' : 'square'} size={18} color={on ? colors.chambray : colors.clay} />
                <Text style={styles.quoteRowText} numberOfLines={3}>« {q.text} »{q.page ? `  · p. ${q.page}` : ''}</Text>
              </Pressable>
            );
          })}
        </BottomSheet>

        <BottomSheet visible={limitSheet} onClose={() => setLimitSheet(false)} title={t('Trois entrées cette semaine, bravo.')} subtitle={t('Le journal gratuit permet trois entrées par semaine. Avec Premium, écris autant que tu lis.')} testID="journal-limit-sheet" scroll={false}>
          <Pressable testID="journal-limit-premium" onPress={() => { setLimitSheet(false); router.push('/premium'); }} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>{t('Découvrir Premium')}</Text>
          </Pressable>
          <Text style={styles.switchSub}>{t('Ton brouillon est conservé : tu pourras l’enregistrer lundi.')}</Text>
        </BottomSheet>

        <Toast visible={!!toast} text={toast || ''} onHide={() => setToast(null)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  dateLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.clay, textTransform: 'capitalize' },
  saveBtn: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', minWidth: 96 },
  saveText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
  restored: { fontFamily: fonts.body, fontSize: 12, color: colors.chambray, marginBottom: spacing.sm },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.sm, marginBottom: spacing.sm },
  bookTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso },
  bookAuthor: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 1 },
  noBook: { alignItems: 'center', paddingVertical: spacing.xl },
  noBookTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso },
  noBookSub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  ghostText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.espresso },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageInput: { width: 84, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, textAlign: 'center', fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso, marginTop: spacing.lg },
  pageTotal: { fontFamily: fonts.body, fontSize: 13, color: colors.clay, marginTop: spacing.lg },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  moodDot: { width: 10, height: 10, borderRadius: 5 },
  moodText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  promptBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bisque, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  promptText: { fontFamily: fonts.display, fontSize: 17, color: colors.espresso, lineHeight: 23 },
  promptAction: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.chambray },
  textarea: { minHeight: 180, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, fontFamily: fonts.body, fontSize: 15.5, lineHeight: 24, color: colors.espresso },
  quoteChip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm, padding: spacing.sm, paddingLeft: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.chambray, backgroundColor: colors.creme, borderRadius: radius.sm },
  quoteChipText: { flex: 1, fontFamily: fonts.display, fontSize: 15, color: colors.espresso, lineHeight: 21 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, marginTop: spacing.xs },
  linkText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  switchTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  switchSub: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
  quoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  quoteRowText: { flex: 1, fontFamily: fonts.display, fontSize: 15, color: colors.espresso, lineHeight: 21 },
  primaryBtn: { height: 48, borderRadius: radius.pill, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.creme },
});
