import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '@/src/theme';
import { QuoteCard, Quote } from '@/src/components/QuoteCard';
import { api } from '@/src/api';

export default function BoardDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    (async () => { const b = await api<any>(`/boards/${id}`); setBoard(b); })();
  }, [id]));

  if (!board) return <View style={{ flex: 1, backgroundColor: colors.glacier }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier }} testID="screen-board">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} testID="board-back" style={styles.iconBtn}><Feather name="chevron-left" size={22} color={colors.espresso} /></Pressable>
        <Text style={styles.h1} numberOfLines={1}>{board.name}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
        <Text style={styles.meta}>{board.visibility === 'private' ? 'PRIVÉ' : board.visibility === 'public' ? 'PUBLIC' : 'COLLABORATIF'}  ·  {board.quotes?.length || 0} épingles</Text>
        {board.description ? <Text style={styles.desc}>{board.description}</Text> : null}
        <View style={{ height: spacing.lg }} />
        {(!board.quotes || board.quotes.length === 0) ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
            <Text style={styles.emptyTitle}>Ton premier passage l'attend.</Text>
            <Text style={styles.emptySub}>Ouvre une citation et épingle-la ici.</Text>
          </View>
        ) : board.quotes.map((q: Quote) => (
          <QuoteCard key={q.quote_id} quote={q} onPress={() => router.push({ pathname: '/quote/[id]', params: { id: q.quote_id } })} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft, backgroundColor: colors.glacier },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.espresso, flex: 1, textAlign: 'center', marginHorizontal: spacing.md },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.clay, letterSpacing: 1.5, textTransform: 'uppercase' },
  desc: { fontFamily: fonts.body, fontSize: 14, color: colors.espresso, marginTop: spacing.sm, lineHeight: 22 },
  emptyTitle: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, textAlign: 'center' },
  emptySub: { fontFamily: fonts.body, fontSize: 14, color: colors.clay, textAlign: 'center', marginTop: spacing.sm },
});
