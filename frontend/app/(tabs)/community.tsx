import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { api } from '@/src/api';
import { PrimaryButton, GhostButton } from '@/src/components/Button';

type Board = {
  board_id: string;
  name: string;
  description?: string;
  visibility: 'private' | 'public' | 'collaborative';
  pins_count?: number;
  preview_quote?: string | null;
};

export default function Community() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [visibility, setVisibility] = useState<'private'|'public'|'collaborative'>('private');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ boards: Board[] }>('/boards'); setBoards(r.boards);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-community">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.h1}>Tes tableaux</Text>
        <Text style={styles.sub}>Épingle les passages qui te ressemblent.</Text>
      </View>
      <FlatList
        data={boards}
        keyExtractor={x => x.board_id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.xl }}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: insets.bottom + 80, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
            <Pressable testID="btn-new-board" onPress={() => setModal(true)} style={styles.newCard}>
              <Feather name="plus" size={22} color={colors.chambray} />
              <Text style={styles.newCardText}>Nouveau tableau</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable testID={`board-${item.board_id}`} onPress={() => router.push({ pathname: '/board/[id]', params: { id: item.board_id } })} style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
            {item.preview_quote ? (
              <Text style={styles.preview} numberOfLines={3}>&ldquo; {item.preview_quote}</Text>
            ) : (
              <Text style={styles.previewEmpty}>Ton premier passage l'attend.</Text>
            )}
            <View style={{ flex: 1 }} />
            <Text style={styles.meta}>{item.visibility === 'private' ? 'PRIVÉ' : item.visibility === 'public' ? 'PUBLIC' : 'COLLABORATIF'} · {item.pins_count || 0} épingles</Text>
          </Pressable>
        )}
        ListEmptyComponent={(
          <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl }}>
            <Text style={styles.emptyTitle}>Ton premier tableau t'attend.</Text>
            <Text style={styles.emptySub}>Rassemble tes citations autour d'un thème.</Text>
          </View>
        )}
      />

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>Nouveau tableau</Text>
            <TextInput testID="new-board-name" value={name} onChangeText={setName} placeholder="Nom (ex: Résilience)" placeholderTextColor={colors.clay} style={styles.input} />
            <TextInput testID="new-board-desc" value={desc} onChangeText={setDesc} placeholder="Description (optionnel)" placeholderTextColor={colors.clay} style={[styles.input, { height: 80 }]} multiline />
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {(['private','public','collaborative'] as const).map(v => (
                <Pressable key={v} testID={`visibility-${v}`} onPress={() => setVisibility(v)} style={[styles.visCard, visibility === v && styles.visCardActive]}>
                  <Text style={[styles.visLabel, visibility === v && { color: colors.creme }]}>
                    {v === 'private' ? 'Privé' : v === 'public' ? 'Public' : 'Collaboratif'}
                  </Text>
                  <Text style={[styles.visDesc, visibility === v && { color: colors.creme, opacity: 0.9 }]}>
                    {v === 'private' ? 'Toi seule.' : v === 'public' ? 'Sur ton profil, dans la découverte.' : 'Les invités peuvent aussi épingler.'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ height: spacing.lg }} />
            <PrimaryButton testID="btn-create-board" title="Créer le tableau" onPress={create} loading={creating} disabled={!name.trim()} />
            <GhostButton title="Annuler" onPress={() => setModal(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.glacier },
  h1: { fontFamily: fonts.displayMedium, fontSize: 30, color: colors.espresso },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, marginTop: 4 },
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
