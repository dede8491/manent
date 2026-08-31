import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { api } from '@/src/api';
import { useT } from '@/src/i18n';
import { buildFicheHtml, FicheData } from '@/src/fichePdf';
import { BookCover } from '@/src/components/BookCover';
import ManentLoader from '@/src/components/ManentLoader';

type Passage = { text: string; note?: string };

function Section({ icon, label, styles, colors, children }: { icon: any; label: string; styles: any; colors: any; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Feather name={icon} size={13} color={colors.chambray} />
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function ListEditor({ items, placeholder, max, onChange, testID, styles, colors, addLabel }: { items: string[]; placeholder: string; max?: number; onChange: (v: string[]) => void; testID: string; styles: any; colors: any; addLabel: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((it, i) => (
        <View key={i} style={styles.listRow}>
          <TextInput
            testID={`${testID}-${i}`}
            value={it}
            onChangeText={v => onChange(items.map((x, j) => (j === i ? v : x)))}
            style={[styles.input, { flex: 1 }]}
            multiline
            placeholder={placeholder}
            placeholderTextColor={colors.clay}
          />
          <Pressable testID={`${testID}-del-${i}`} onPress={() => onChange(items.filter((_, j) => j !== i))} style={styles.delBtn} hitSlop={8}>
            <Feather name="x" size={15} color={colors.clay} />
          </Pressable>
        </View>
      ))}
      {(!max || items.length < max) && (
        <Pressable testID={`${testID}-add`} onPress={() => onChange([...items, ''])} style={styles.addRow}>
          <Feather name="plus" size={14} color={colors.chambray} />
          <Text style={styles.addRowText}>{addLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function FicheDeLecture() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const [book, setBook] = useState<any>(null);
  const [fiche, setFiche] = useState<FicheData>({});
  const [rating, setRating] = useState(0);
  const [saved, setSaved] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filling, setFilling] = useState(false);
  const [clubModal, setClubModal] = useState(false);
  const [clubs, setClubs] = useState<any[]>([]);
  const [sentTo, setSentTo] = useState('');
  const timer = useRef<any>(null);

  // Remplissage IA des champs vides (genre, éditeur, auteur, résumé)
  const autofill = async () => {
    if (filling) return;
    setFilling(true);
    try {
      const r = await api<{ suggestions: any }>(`/books/${bookId}/fiche/autofill`, { method: 'POST' });
      const s = r.suggestions || {};
      const next: FicheData = { ...fiche };
      if (!next.genre && s.genre) next.genre = s.genre;
      if (!next.publisher && s.publisher) next.publisher = s.publisher;
      if (!next.author_bio && s.author_bio) next.author_bio = s.author_bio;
      if (!next.summary && s.summary) next.summary = s.summary;
      setFiche(next);
      save(next, rating);
    } catch {} finally {
      setFilling(false);
    }
  };

  // Envoi des questions « On en parle ? » dans un club
  const openClubModal = async () => {
    try {
      const r = await api<{ clubs: any[] }>('/clubs');
      setClubs(r.clubs || []);
    } catch { setClubs([]); }
    setSentTo('');
    setClubModal(true);
  };
  const sendToClub = async (club: any) => {
    const qs = (fiche.questions || []).filter(x => x.trim());
    if (!qs.length) return;
    const text = `${t('On en parle ?')} — ${book.title}\n` + qs.map((x, i) => `${i + 1}. ${x.trim()}`).join('\n');
    try {
      await api(`/clubs/${club.club_id}/messages`, { method: 'POST', body: JSON.stringify({ text }) });
      setSentTo(club.name);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api<any>(`/books/${bookId}/fiche`);
        setBook(r.book);
        setFiche({
          ...r.fiche,
          ideas: r.fiche.ideas || [],
          passages: r.fiche.passages || [],
          takeaways: r.fiche.takeaways || [],
          questions: r.fiche.questions || [],
        });
        setRating(r.rating || 0);
      } catch {}
    })();
  }, [bookId]);

  // Sauvegarde automatique (débouncée)
  const save = useCallback((next: FicheData, nextRating: number) => {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api(`/books/${bookId}/fiche`, { method: 'PUT', body: JSON.stringify({ ...next, rating: nextRating }) });
        setSaved(true);
      } catch {}
    }, 1200);
  }, [bookId]);

  const upd = (patch: Partial<FicheData>) => {
    const next = { ...fiche, ...patch };
    setFiche(next);
    save(next, rating);
  };
  const updRating = (n: number) => {
    const v = n === rating ? 0 : n;
    setRating(v);
    save(fiche, v);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const st = await api<{ is_premium: boolean }>('/premium/status');
      if (!st.is_premium) {
        router.push('/premium');
        return;
      }
      const labels = {
        carnet: t('Fiche de lecture'),
        author: t('L’auteur'),
        summary: t('En 5 minutes'),
        ideas: t('Les 5 idées à retenir'),
        passages: t('Les passages marquants'),
        takeaways: t('Ce que j’en retiens'),
        questions: t('On en parle ?'),
        review: t('Mon avis'),
        recommend: t('À qui je le recommande ?'),
      };
      const html = buildFicheHtml(book, fiche, rating, labels);
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 600); }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('Fiche de lecture') });
        }
      }
    } catch {} finally {
      setExporting(false);
    }
  };

  if (!book) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center' }}>
        <ManentLoader size={48} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.glacier }}>
      <View style={{ flex: 1 }} testID="screen-fiche">
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} testID="fiche-back" style={styles.iconBtn}>
            <Feather name="chevron-left" size={22} color={colors.espresso} />
          </Pressable>
          <Text style={styles.headerLabel}>{t('Fiche de lecture')}</Text>
          <View style={{ width: 40, alignItems: 'center' }}>
            {saved ? <Feather name="check" size={16} color={colors.chambray} /> : <ManentLoader size={20} />}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
          <Section styles={styles} colors={colors} icon="book" label={t('Le livre')}>
            <View style={styles.bookCard}>
              <BookCover uri={book.cover} title={book.title} width={48} height={66} initialSize={24} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.bookTitle}>{book.title}</Text>
                {!!book.author && <Text style={styles.bookMeta}>{book.author}</Text>}
                <Text style={styles.bookMeta}>
                  {[book.year, book.pages ? t('{n} pages', { n: book.pages }) : null].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TextInput testID="fiche-genre" value={fiche.genre || ''} onChangeText={v => upd({ genre: v })} style={[styles.input, { flex: 1 }]} placeholder={t('Genre (roman, essai…)')} placeholderTextColor={colors.clay} />
              <TextInput testID="fiche-publisher" value={fiche.publisher || ''} onChangeText={v => upd({ publisher: v })} style={[styles.input, { flex: 1 }]} placeholder={t('Éditeur')} placeholderTextColor={colors.clay} />
            </View>
            <Pressable testID="fiche-autofill" onPress={autofill} disabled={filling} style={styles.aiBtn}>
              {filling ? <ManentLoader size={20} /> : <Feather name="zap" size={14} color={colors.chambray} />}
              <Text style={styles.aiBtnText}>{filling ? t('L’IA rédige…') : t('Remplir avec l’IA (genre, éditeur, auteur, résumé)')}</Text>
            </Pressable>
          </Section>

          <Section styles={styles} colors={colors} icon="user" label={t('L’auteur')}>
            <TextInput testID="fiche-author-bio" value={fiche.author_bio || ''} onChangeText={v => upd({ author_bio: v })} style={[styles.input, styles.multiline]} multiline placeholder={t('Sa vie, son parcours, ses autres œuvres, le contexte d’écriture…')} placeholderTextColor={colors.clay} />
          </Section>

          <Section styles={styles} colors={colors} icon="clock" label={t('En 5 minutes')}>
            <TextInput testID="fiche-summary" value={fiche.summary || ''} onChangeText={v => upd({ summary: v })} style={[styles.input, styles.multiline, { minHeight: 110 }]} multiline placeholder={t('Le résumé ultra-court : l’histoire, les grandes étapes, les personnages clés — sans tout dévoiler.')} placeholderTextColor={colors.clay} />
          </Section>

          <Section styles={styles} colors={colors} icon="zap" label={t('Les 5 idées à retenir')}>
            <ListEditor styles={styles} colors={colors} addLabel={t('Ajouter')} testID="fiche-idea" items={fiche.ideas || []} max={5} placeholder={t('Une idée essentielle du livre…')} onChange={v => upd({ ideas: v })} />
          </Section>

          <Section styles={styles} colors={colors} icon="bookmark" label={t('Les passages marquants')}>
            <View style={{ gap: spacing.sm }}>
              {(fiche.passages || []).map((p, i) => (
                <View key={i} style={styles.passageCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <TextInput
                      testID={`fiche-passage-${i}`}
                      value={p.text}
                      onChangeText={v => upd({ passages: (fiche.passages || []).map((x, j) => (j === i ? { ...x, text: v } : x)) })}
                      style={[styles.passageText, { flex: 1 }]}
                      multiline
                      placeholder={t('Le passage…')}
                      placeholderTextColor={colors.clay}
                    />
                    <Pressable testID={`fiche-passage-del-${i}`} onPress={() => upd({ passages: (fiche.passages || []).filter((_, j) => j !== i) })} style={styles.delBtn} hitSlop={8}>
                      <Feather name="x" size={15} color={colors.clay} />
                    </Pressable>
                  </View>
                  <TextInput
                    testID={`fiche-passage-note-${i}`}
                    value={p.note || ''}
                    onChangeText={v => upd({ passages: (fiche.passages || []).map((x, j) => (j === i ? { ...x, note: v } : x)) })}
                    style={styles.passageNote}
                    multiline
                    placeholder={t('Pourquoi ce passage te parle…')}
                    placeholderTextColor={colors.clay}
                  />
                </View>
              ))}
              <Pressable testID="fiche-passage-add" onPress={() => upd({ passages: [...(fiche.passages || []), { text: '', note: '' }] })} style={styles.addRow}>
                <Feather name="plus" size={14} color={colors.chambray} />
                <Text style={styles.addRowText}>{t('Ajouter un passage')}</Text>
              </Pressable>
            </View>
          </Section>

          <Section styles={styles} colors={colors} icon="feather" label={t('Ce que j’en retiens')}>
            <ListEditor styles={styles} colors={colors} addLabel={t('Ajouter')} testID="fiche-takeaway" items={fiche.takeaways || []} placeholder={t('Un enseignement à appliquer dans ta vie…')} onChange={v => upd({ takeaways: v })} />
          </Section>

          <Section styles={styles} colors={colors} icon="message-circle" label={t('On en parle ?')}>
            <Text style={styles.hint}>{t('Des questions pour ton club : quel passage vous a marqué ? Étiez-vous d’accord avec l’auteur ?')}</Text>
            <ListEditor styles={styles} colors={colors} addLabel={t('Ajouter')} testID="fiche-question" items={fiche.questions || []} placeholder={t('Une question à débattre…')} onChange={v => upd({ questions: v })} />
            {(fiche.questions || []).some(x => x.trim()) && (
              <Pressable testID="fiche-send-club" onPress={openClubModal} style={styles.aiBtn}>
                <Feather name="users" size={14} color={colors.chambray} />
                <Text style={styles.aiBtnText}>{t('Envoyer ces questions à un club')}</Text>
              </Pressable>
            )}
          </Section>

          <Section styles={styles} colors={colors} icon="star" label={t('Mon avis')}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.sm }}>
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable key={n} testID={`fiche-star-${n}`} onPress={() => updRating(n)} hitSlop={6}>
                  <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={26} color={n <= rating ? colors.chambray : colors.bisque} />
                </Pressable>
              ))}
            </View>
            <TextInput testID="fiche-review" value={fiche.review || ''} onChangeText={v => upd({ review: v })} style={[styles.input, styles.multiline]} multiline placeholder={t('Ce que tu as aimé, moins aimé, ce qui t’a surprise, fait réfléchir…')} placeholderTextColor={colors.clay} />
          </Section>

          <Section styles={styles} colors={colors} icon="send" label={t('À qui je le recommande ?')}>
            <TextInput testID="fiche-recommend" value={fiche.recommend || ''} onChangeText={v => upd({ recommend: v })} style={[styles.input, styles.multiline, { minHeight: 70 }]} multiline placeholder={t('Le profil de lecteur qui aimera ce livre…')} placeholderTextColor={colors.clay} />
          </Section>

          <Pressable testID="fiche-export" onPress={exportPdf} disabled={exporting} style={styles.exportBtn}>
            {exporting ? <ManentLoader size={20} /> : (
              <>
                <Feather name="download" size={15} color={colors.creme} />
                <Text style={styles.exportText}>{t('Exporter et partager en PDF')}</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.premiumNote}>{t('Export PDF réservé aux membres Premium.')}</Text>
        </ScrollView>

        <Modal visible={clubModal} transparent animationType="fade" onRequestClose={() => setClubModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>{t('Envoyer à un club')}</Text>
              {sentTo ? (
                <Text style={styles.modalText} testID="fiche-club-sent">{t('Questions envoyées à « {name} ».', { name: sentTo })}</Text>
              ) : clubs.length === 0 ? (
                <Text style={styles.modalText}>{t('Tu n’as pas encore de club. Crée-en un depuis Communauté.')}</Text>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {clubs.map(c => (
                    <Pressable key={c.club_id} testID={`fiche-club-${c.club_id}`} onPress={() => sendToClub(c)} style={styles.clubRow}>
                      <Feather name="users" size={15} color={colors.chambray} />
                      <Text style={styles.clubRowText}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable testID="fiche-club-close" onPress={() => setClubModal(false)} style={{ alignSelf: 'center', marginTop: spacing.md, padding: spacing.sm }}>
                <Text style={styles.aiBtnText}>{t('Fermer')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 2, textTransform: 'uppercase' },
  section: { marginBottom: spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingBottom: 6 },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.chambray, letterSpacing: 2, textTransform: 'uppercase' },
  bookCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, alignItems: 'center' },
  cover: { width: 48, height: 66, borderRadius: 6, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  coverInitial: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  bookTitle: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.espresso },
  bookMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay },
  input: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: spacing.md, paddingVertical: 10, minHeight: 44 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  delBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, minHeight: 44 },
  addRowText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray },
  passageCard: { backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.bisque },
  passageText: { fontFamily: fonts.display, fontSize: 15.5, fontStyle: 'italic', color: colors.espresso, lineHeight: 23, minHeight: 40 },
  passageNote: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 4, minHeight: 30 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginBottom: spacing.sm, fontStyle: 'italic' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, backgroundColor: colors.chambray, marginTop: spacing.sm },
  exportText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  premiumNote: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, textAlign: 'center', marginTop: spacing.sm, fontStyle: 'italic' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme },
  aiBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chambray, flexShrink: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(58,33,25,0.55)', justifyContent: 'center', padding: spacing.xl },
  modalBox: { backgroundColor: colors.creme, borderRadius: 20, padding: spacing.xl },
  modalTitle: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.espresso },
  modalText: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: spacing.sm, lineHeight: 20 },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.glacier },
  clubRowText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
});
