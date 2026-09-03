import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Share, Platform, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '@/src/api';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';
import { BottomSheet } from '@/src/components/BottomSheet';

type Reader = { pseudo: string; handle: string; picture?: string | null };
type Member = { user_id?: string; pseudo?: string; handle?: string; picture?: string | null };

// Feuille « Partager et inviter » commune aux tableaux et aux clubs : lien à envoyer, code,
// invitation directe d'une lectrice (que je suis ou qui me suit), membres, quitter.
export function InviteSheet({ visible, onClose, kind, targetId, name, link, code, members, isOwner, onLeft, onRegenerate, testID = 'invite' }: {
  visible: boolean; onClose: () => void; kind: 'board' | 'club'; targetId: string; name: string; link: string; code?: string;
  members?: Member[]; isOwner?: boolean; onLeft?: () => void; onRegenerate?: () => Promise<void>; testID?: string;
}) {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [q, setQ] = useState('');
  const [sent, setSent] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const memberHandles = new Set((members || []).map(m => m.handle));

  useEffect(() => {
    if (!visible) return;
    setMsg(null);
    api<{ readers: Reader[] }>('/readers/contacts').then(r => setReaders(r.readers || [])).catch(() => setReaders([]));
  }, [visible]);

  const label = kind === 'board' ? t('le tableau') : t('le club de lecture');
  const shareLink = async () => {
    const message = kind === 'board'
      ? `${t('Rejoins mon tableau « {name} » sur Manent', { name })} — ${link}`
      : `${t('Rejoins mon club de lecture « {name} » sur Manent avec le code {code}', { name, code: code || '' })} — ${link}`;
    try {
      if (Platform.OS === 'web') {
        const nav: any = navigator;
        if (nav.share) await nav.share({ text: message });
        else if (nav.clipboard) { await nav.clipboard.writeText(message); setMsg(t('Lien copié.')); }
      } else {
        await Share.share({ message });
      }
    } catch {}
  };
  const invite = async (r: Reader) => {
    setSent(s => ({ ...s, [r.handle]: 'sending' }));
    try {
      const res = await api<{ already_member?: boolean; already_sent?: boolean }>('/invitations', { method: 'POST', body: JSON.stringify({ kind, target_id: targetId, to_handle: r.handle }) });
      setSent(s => ({ ...s, [r.handle]: res.already_member ? 'member' : 'sent' }));
    } catch { setSent(s => ({ ...s, [r.handle]: 'error' })); }
  };
  const shown = readers.filter(r => !q.trim() || r.pseudo.toLowerCase().includes(q.trim().toLowerCase()) || r.handle.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('Partager et inviter')} subtitle={name} testID={`${testID}-sheet`}>
      <Pressable testID={`${testID}-share-link`} onPress={shareLink} style={styles.primary}>
        <Feather name="share" size={16} color={colors.creme} />
        <Text style={styles.primaryText}>{t('Envoyer le lien d’invitation')}</Text>
      </Pressable>
      {!!code && (
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>{t('Code')}</Text>
          <Text style={styles.code} testID={`${testID}-code`}>{code}</Text>
          {isOwner && onRegenerate && (
            <Pressable testID={`${testID}-regenerate`} onPress={async () => { await onRegenerate(); setMsg(t('Nouveau code : les anciens liens ne fonctionnent plus.')); }} hitSlop={8}>
              <Feather name="refresh-cw" size={15} color={colors.chambray} />
            </Pressable>
          )}
        </View>
      )}
      <Text style={styles.hint}>{t('Toute personne qui a le lien peut rejoindre {x}.', { x: label })}</Text>
      {!!msg && <Text style={styles.msg}>{msg}</Text>}

      <Text style={styles.section}>{t('Inviter une lectrice')}</Text>
      <View style={styles.searchBox}>
        <Feather name="search" size={15} color={colors.clay} />
        <TextInput testID={`${testID}-search`} value={q} onChangeText={setQ} placeholder={t('Chercher parmi les lectrices que tu suis…')} placeholderTextColor={colors.clay} style={styles.searchInput} />
      </View>
      {shown.length === 0 ? (
        <Text style={styles.hint}>{readers.length === 0 ? t('Suis des lectrices pour pouvoir les inviter directement. En attendant, envoie le lien.') : t('Aucune lectrice ne correspond.')}</Text>
      ) : shown.slice(0, 30).map(r => {
        const st = memberHandles.has(r.handle) ? 'member' : sent[r.handle];
        return (
          <View key={r.handle} style={styles.reader} testID={`${testID}-reader-${r.handle}`}>
            {r.picture ? <Image source={{ uri: r.picture }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.initial}>{(r.pseudo?.[0] || 'M').toUpperCase()}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.pseudo}</Text>
              <Text style={styles.rowSub}>@{r.handle}</Text>
            </View>
            {st === 'member' ? <Text style={styles.state}>{t('Membre')}</Text>
              : st === 'sent' ? <Text style={styles.state}>{t('Invitée')}</Text>
              : st === 'sending' ? <Text style={styles.state}>…</Text>
              : (
                <Pressable testID={`${testID}-invite-${r.handle}`} onPress={() => invite(r)} style={styles.inviteBtn}>
                  <Text style={styles.inviteText}>{st === 'error' ? t('Réessayer') : t('Inviter')}</Text>
                </Pressable>
              )}
          </View>
        );
      })}

      {(members || []).length > 0 && (
        <>
          <Text style={styles.section}>{t('Membres ({n})', { n: members!.length })}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {members!.map((m, i) => <View key={m.handle || i} style={styles.memberChip}><Text style={styles.memberText}>{m.pseudo || m.handle}</Text></View>)}
          </View>
        </>
      )}
      {!isOwner && onLeft && (
        <Pressable testID={`${testID}-leave`} onPress={onLeft} style={styles.leave}>
          <Text style={styles.leaveText}>{kind === 'board' ? t('Quitter le tableau') : t('Quitter le club')}</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  primary: { height: 48, borderRadius: radius.pill, backgroundColor: colors.chambray, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  codeLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, color: colors.clay, letterSpacing: 1.2, textTransform: 'uppercase' },
  code: { fontFamily: fonts.displayMedium, fontSize: 22, color: colors.espresso, letterSpacing: 3, flex: 1 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.clay, marginTop: spacing.sm, lineHeight: 17 },
  msg: { fontFamily: fonts.body, fontSize: 12.5, color: colors.chambray, marginTop: spacing.sm },
  section: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.espresso, marginTop: spacing.lg, marginBottom: spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.creme, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.espresso },
  reader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.espresso },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.espresso },
  rowSub: { fontFamily: fonts.body, fontSize: 12, color: colors.clay },
  state: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.clay },
  inviteBtn: { height: 32, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  inviteText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.chambray },
  memberChip: { height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.bisque, alignItems: 'center', justifyContent: 'center' },
  memberText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.espresso },
  leave: { marginTop: spacing.lg, alignSelf: 'center', padding: spacing.sm },
  leaveText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: '#B3552F' },
});
