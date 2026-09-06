import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT, useLang } from '@/src/i18n';
import { timeAgo } from '@/src/timeago';
import { BottomSheet } from '@/src/components/BottomSheet';

type U = { user_id: string; pseudo: string; handle: string; email: string; picture?: string | null; is_admin?: boolean; is_me?: boolean; created_at: string; last_login?: string | null; books: number; quotes: number };

// Admin — liste de tous les comptes, recherche, suppression directe d'un compte (et de tout son contenu)
// après confirmation. Les comptes admin ne sont pas supprimables.
export function UsersAdmin() {
  const t = useT();
  const lang = useLang();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [users, setUsers] = useState<U[] | null>(null);
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<U | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await api<{ users: U[] }>(`/admin/users?q=${encodeURIComponent(q)}`); setUsers(r.users); }
    catch { setUsers([]); }
  }, [q]);
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);

  const remove = async () => {
    if (!target) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ deleted: number }>(`/admin/users/${target.user_id}`, { method: 'DELETE' });
      setUsers(prev => (prev || []).filter(u => u.user_id !== target.user_id));
      setMsg(t('Compte @{h} supprimé ({n} éléments).', { h: target.handle, n: r.deleted }));
    } catch { setMsg(t('Suppression impossible.')); }
    setBusy(false); setTarget(null);
  };

  return (
    <View testID="admin-users">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.sectionTitle}>{t('Comptes')}</Text>
        {users && <View style={styles.countPill}><Text style={styles.countText}>{users.length}</Text></View>}
      </View>
      <View style={styles.search}>
        <Feather name="search" size={14} color={colors.clay} />
        <TextInput testID="users-search" value={q} onChangeText={setQ} placeholder={t('Pseudo, @handle ou e-mail')} placeholderTextColor={colors.clay} style={styles.input} autoCapitalize="none" autoCorrect={false} />
        {q.length > 0 && <Pressable onPress={() => setQ('')} hitSlop={8}><Feather name="x" size={14} color={colors.clay} /></Pressable>}
      </View>
      {!!msg && <Text style={styles.msg}>{msg}</Text>}
      {users === null ? null : users.length === 0 ? (
        <Text style={styles.empty}>{t('Aucun compte.')}</Text>
      ) : users.map(u => (
        <View key={u.user_id} style={styles.row} testID={`admin-user-${u.handle}`}>
          {u.picture ? <Image source={{ uri: u.picture }} style={styles.avatar} /> : (
            <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.avatarLetter}>{(u.pseudo || '?').slice(0, 1).toUpperCase()}</Text></View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{u.pseudo} <Text style={styles.handle}>@{u.handle}</Text>{u.is_admin ? <Text style={styles.adminTag}>  {t('admin')}</Text> : null}</Text>
            <Text style={styles.meta} numberOfLines={1}>{u.email}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {t('{n} livres', { n: u.books })} · {t('{n} citations', { n: u.quotes })} · {t('créé')} {timeAgo(u.created_at, lang)}{u.last_login ? ` · ${t('connecté')} ${timeAgo(u.last_login, lang)}` : ''}
            </Text>
          </View>
          {!u.is_admin && !u.is_me && (
            <Pressable testID={`admin-user-delete-${u.handle}`} onPress={() => setTarget(u)} style={styles.trashBtn} hitSlop={6}>
              <Feather name="trash-2" size={15} color="#B3552F" />
            </Pressable>
          )}
        </View>
      ))}

      <BottomSheet visible={!!target} onClose={() => setTarget(null)} title={t('Supprimer ce compte ?')} testID="admin-user-confirm" scroll={false}>
        {target && (
          <>
            <Text style={styles.confirmName}>{target.pseudo} · @{target.handle}</Text>
            <Text style={styles.help}>{target.email}</Text>
            <Text style={styles.help}>{t('Ses {b} livres, {q} citations, tableaux, clubs et abonnements seront supprimés. Une sauvegarde est écrite sur le serveur avant.', { b: target.books, q: target.quotes })}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
              <Pressable testID="admin-user-cancel" onPress={() => setTarget(null)} style={styles.ghostBtn}><Text style={styles.ghostText}>{t('Annuler')}</Text></Pressable>
              <Pressable testID="admin-user-confirm-go" onPress={remove} disabled={busy} style={[styles.dangerBtn, busy && { opacity: 0.5 }]}>
                <Feather name="trash-2" size={13} color={colors.creme} /><Text style={styles.dangerText}>{busy ? '…' : t('Supprimer définitivement')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  sectionTitle: { fontFamily: fonts.displayMedium, fontSize: 21, color: colors.espresso, marginTop: spacing.xl, marginBottom: spacing.md },
  countPill: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl - spacing.md },
  countText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.creme },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.espresso, paddingVertical: 0 },
  msg: { fontFamily: fonts.body, fontSize: 12.5, color: colors.chambray, marginBottom: spacing.sm },
  empty: { fontFamily: fonts.body, fontSize: 13.5, color: colors.clay },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.creme, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.sm, paddingRight: spacing.xs, marginBottom: 6 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bisque },
  avatarLetter: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.espresso },
  name: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.espresso },
  handle: { fontFamily: fonts.body, color: colors.clay },
  adminTag: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.chambray, letterSpacing: 0.8, textTransform: 'uppercase' },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.clay, marginTop: 1 },
  trashBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  confirmName: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.espresso, marginBottom: 2 },
  help: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, lineHeight: 17, marginBottom: spacing.xs },
  ghostBtn: { height: 38, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.body, fontSize: 13, color: colors.espresso },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: '#B3552F' },
  dangerText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme },
});
