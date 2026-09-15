import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { BookCover } from '@/src/components/BookCover';

// ---- Carte livre (couverture 2:3 plein cadre + pastille Ajouter) ----
export function BookCardFeed({ title, author, cover, onPress, width = 118, testID }: any) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} style={{ width }}>
      <View>
        <BookCover uri={cover} title={title} width={width} height={width * 1.5} radius={8} initialSize={32} />
        <View style={styles.addDot}><Feather name="plus" size={13} color={colors.creme} /></View>
      </View>
      <Text style={styles.bookTitle} numberOfLines={2}>{title}</Text>
      {!!author && <Text style={styles.bookAuthor} numberOfLines={1}>{author}</Text>}
    </Pressable>
  );
}

// ---- Carte livre primé (ruban Chambray) ----

// ---- Carte collection thématique (3 couvertures en éventail) ----
export function CollectionCard({ theme, quotes, covers, label, onPress, testID }: any) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.collection}>
      <View style={styles.fan}>
        {(covers.length ? covers : [null, null, null]).slice(0, 3).map((c: string | null, i: number) => (
          <View key={i} style={[styles.fanItem, { transform: [{ rotate: `${(i - 1) * 7}deg` }, { translateX: (i - 1) * 22 }] }]}>
            <BookCover uri={c} title={theme} width={52} height={76} radius={6} initialSize={20} />
          </View>
        ))}
      </View>
      <Text style={styles.collectionTitle} numberOfLines={1}>{theme}</Text>
      <Text style={styles.collectionMeta}>{label}</Text>
    </Pressable>
  );
}

// ---- Reprendre ta lecture (carte large) ----

// ---- Lecture suivante (quand rien n'est en cours) ----

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  addDot: { position: 'absolute', bottom: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  bookTitle: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.espresso, marginTop: 6, lineHeight: 17 },
  bookAuthor: { fontFamily: fonts.body, fontSize: 11, color: colors.clay, marginTop: 1 },
  ribbon: { position: 'absolute', top: 8, left: -4, backgroundColor: colors.chambray, paddingHorizontal: 8, paddingVertical: 3, borderTopRightRadius: 4, borderBottomRightRadius: 4, maxWidth: 118 },
  ribbonText: { fontFamily: fonts.bodyMedium, fontSize: 8.5, color: colors.creme, letterSpacing: 0.8, textTransform: 'uppercase' },
  collection: { width: 200, backgroundColor: colors.bisque, borderRadius: 16, padding: spacing.md, alignItems: 'center' },
  fan: { height: 84, width: 120, alignItems: 'center', justifyContent: 'center' },
  fanItem: { position: 'absolute' },
  collectionTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso, marginTop: spacing.sm, textTransform: 'capitalize' },
  collectionMeta: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  resume: { backgroundColor: colors.creme, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  resumeLabel: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.chambray, letterSpacing: 1.5, textTransform: 'uppercase' },
  resumeTitle: { fontFamily: fonts.displayMedium, fontSize: 19, color: colors.espresso, marginTop: 2 },
  resumeAuthor: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: 1 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
  nextText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.clay },
  resumeBar: { height: 4, backgroundColor: colors.borderSoft, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  resumeFill: { height: 4, backgroundColor: colors.chambray },
  resumeMeta: { fontFamily: fonts.bodyMedium, fontSize: 9.5, color: colors.clay, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.chambray, marginTop: spacing.sm },
  photoBtnText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.creme },
});
