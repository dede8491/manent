import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { BookCover } from '@/src/components/BookCover';
import { ClassificationLines } from '@/src/components/ClassificationLines';

// Ligne de résultat du catalogue (navigation, intention, recherche) : couverture, titre, auteur,
// puis les lignes de classification. Ouvre la fiche découverte.
export function CatalogBookRow({ book, testID, onPress }: { book: any; testID?: string; onPress?: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const open = onPress || (() => router.push({ pathname: '/discover/book', params: {
    title: book.title, author: book.author || '', cover: book.cover || '', year: book.year || '', summary: book.summary || '', catalog_id: book.catalog_id || '' } }));
  return (
    <Pressable testID={testID} onPress={open} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <BookCover uri={book.cover} title={book.title} width={52} height={76} radius={6} initialSize={20} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        {!!book.author && <Text style={styles.author} numberOfLines={1}>{[book.author, book.year].filter(Boolean).join('  ·  ')}</Text>}
        <ClassificationLines lines={book.lines} compact style={{ marginTop: 4 }} />
      </View>
      <Feather name="chevron-right" size={18} color={colors.clay} />
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 8 },
  title: { fontFamily: fonts.displayMedium, fontSize: 15.5, color: colors.espresso, lineHeight: 19 },
  author: { fontFamily: fonts.body, fontSize: 12, color: colors.clay, marginTop: 2 },
});
