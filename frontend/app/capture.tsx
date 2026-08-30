import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { PrimaryButton, GhostButton } from '@/src/components/Button';
import { toBase64 } from '@/src/image';
import { api } from '@/src/api';

export default function CaptureModal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [text, setText] = useState('');
  const [page, setPage] = useState('');
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [books, setBooks] = useState<{ book_id: string; title: string; type: string }[]>([]);
  const [bookId, setBookId] = useState<string | null>(null);
  const [themes] = useState<string[]>(['résilience','amour','argent','foi','leadership','famille','confiance','deuil','spiritualité','santé','voyage','entrepreneuriat']);

  React.useEffect(() => {
    (async () => {
      try { const r = await api<{ books: any[] }>('/books'); setBooks(r.books.map(b => ({ book_id: b.book_id, title: b.title, type: b.type }))); } catch {}
    })();
  }, []);

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: false });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const uri = res.assets[0].uri;
    setImageUri(uri);
    setTranscribing(true);
    try {
      const b64 = await toBase64(uri);
      const r = await api<{ text: string }>('/vision', { method: 'POST', body: JSON.stringify({ image_base64: b64, mode: 'transcribe' }) });
      setText(r.text || '');
    } catch (e: any) {
      // still allow manual entry
    } finally { setTranscribing(false); }
  };

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const q = await api<{ quote_id: string }>('/quotes', {
        method: 'POST',
        body: JSON.stringify({
          text: text.trim(),
          book_id: bookId || undefined,
          page: page ? parseInt(page, 10) : undefined,
          note: note || undefined,
          themes: selectedThemes,
          is_public: isPublic,
        }),
      });
      router.replace({ pathname: '/quote/[id]', params: { id: q.quote_id } });
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-capture">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="capture-close" style={styles.iconBtn}>
          <Feather name="x" size={22} color={colors.espresso} />
        </Pressable>
        <Text style={styles.h1}>Capturer un passage</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        {imageUri ? (
          <View style={styles.imgWrap}>
            <Image source={{ uri: imageUri }} style={styles.img} resizeMode="cover" />
            {transcribing && (
              <View style={styles.transcribing}>
                <ActivityIndicator color={colors.creme} />
                <Text style={styles.transcribingText}>Transcription en cours…</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.pickRow}>
            <Pressable testID="btn-camera" onPress={() => pickImage(true)} style={styles.pickBtn}>
              <Feather name="camera" size={26} color={colors.chambray} />
              <Text style={styles.pickLabel}>Photographier</Text>
            </Pressable>
            <Pressable testID="btn-gallery" onPress={() => pickImage(false)} style={styles.pickBtn}>
              <Feather name="image" size={26} color={colors.chambray} />
              <Text style={styles.pickLabel}>Depuis la galerie</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>Texte de la citation</Text>
        <TextInput
          testID="capture-text"
          value={text} onChangeText={setText}
          placeholder="Transcris ou colle ton passage…"
          placeholderTextColor={colors.clay}
          style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
          multiline
        />

        <Text style={styles.label}>Livre de rattachement</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable onPress={() => setBookId(null)} style={[styles.chip, !bookId && styles.chipActive]}>
            <Text style={[styles.chipText, !bookId && styles.chipTextActive]}>Aucun</Text>
          </Pressable>
          {books.map(b => (
            <Pressable key={b.book_id} testID={`cap-book-${b.book_id}`} onPress={() => setBookId(b.book_id)} style={[styles.chip, bookId === b.book_id && styles.chipActive]}>
              <Text style={[styles.chipText, bookId === b.book_id && styles.chipTextActive]} numberOfLines={1}>{b.title}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Page</Text>
            <TextInput testID="capture-page" value={page} onChangeText={setPage} keyboardType="number-pad" style={styles.input} placeholder="142" placeholderTextColor={colors.clay} />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Note personnelle</Text>
            <TextInput testID="capture-note" value={note} onChangeText={setNote} style={styles.input} placeholder="Optionnel" placeholderTextColor={colors.clay} />
          </View>
        </View>

        <Text style={styles.label}>Thèmes</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {themes.map(t => {
            const on = selectedThemes.includes(t);
            return (
              <Pressable key={t} testID={`cap-theme-${t}`} onPress={() => setSelectedThemes(p => on ? p.filter(x => x !== t) : [...p, t])} style={[styles.chip, on && styles.chipActive]}>
                <Text style={[styles.chipText, on && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable testID="toggle-public" onPress={() => setIsPublic(v => !v)} style={styles.visRow}>
          <Feather name={isPublic ? 'check-square' : 'square'} size={20} color={colors.chambray} />
          <Text style={styles.visText}>Rendre cette citation publique</Text>
        </Pressable>

        <View style={{ height: spacing.lg }} />
        <PrimaryButton testID="btn-save-quote" title="Enregistrer la citation" onPress={save} loading={saving} disabled={!text.trim()} />
        <GhostButton title="Annuler" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso },
  pickRow: { flexDirection: 'row', gap: spacing.md },
  pickBtn: { flex: 1, height: 120, backgroundColor: colors.creme, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.borderSoft },
  pickLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.espresso, letterSpacing: 0.5 },
  imgWrap: { position: 'relative', height: 220, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bisque },
  img: { width: '100%', height: '100%' },
  transcribing: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(58,33,25,0.72)', flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md },
  transcribingText: { color: colors.creme, fontFamily: fonts.bodyMedium, fontSize: 13, letterSpacing: 0.3 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.xs },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15, color: colors.espresso, backgroundColor: colors.creme },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.creme },
  chipActive: { backgroundColor: colors.chambray, borderColor: colors.chambray },
  chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso, maxWidth: 160 },
  chipTextActive: { color: colors.creme, fontFamily: fonts.bodyMedium },
  visRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
  visText: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso },
});
