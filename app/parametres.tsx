import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Chip, Field, Screen, ScreenHeader, SectionHeader, Segmented, Text } from '@/components';
import { ONBOARDING_THEMES } from '@/data/themes';
import { timeAgo } from '@/lib/format';
import { hasBackend } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { colors, spacing } from '@/theme';
import type { Visibility } from '@/types';

export default function Parametres() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const updateUser = useStore((s) => s.updateUser);
  const toggleFollowedTheme = useStore((s) => s.toggleFollowedTheme);
  const resetAll = useStore((s) => s.resetAll);

  const [notifs, setNotifs] = useState({
    wattpad: true,
    clubs: true,
    reminders: true,
    themes: true,
  });
  const [exporting, setExporting] = useState(false);

  /** Export RGPD : l'intégralité des données locales, en JSON lisible. */
  const exportData = async () => {
    setExporting(true);
    try {
      const state = useStore.getState();
      const payload = {
        exportedAt: new Date().toISOString(),
        app: 'Manent',
        user: state.user,
        books: state.books,
        quotes: state.quotes,
        boards: state.boards,
        pins: state.pins,
        clubs: state.clubs.filter((c) => c.joined),
        flashcards: state.flashcards,
      };
      const dir = FileSystem.Paths.cache;
      const file = new FileSystem.File(dir, 'manent-donnees.json');
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
      } else {
        Alert.alert('Export prêt', file.uri);
      }
    } catch {
      Alert.alert('Export impossible', "Le fichier n'a pas pu être créé.");
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = () =>
    Alert.alert(
      'Supprimer mon compte',
      'Toutes tes lectures, citations, tableaux et clubs seront effacés définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            resetAll();
            router.replace('/onboarding/bienvenue');
          },
        },
      ],
    );

  return (
    <Screen>
      <ScreenHeader title="Paramètres" />

      <SectionHeader title="Compte" />
      <Card>
        <Field label="Pseudo" value={user.pseudo} onChangeText={(pseudo) => updateUser({ pseudo })} />
        <Field
          label="Bio"
          value={user.bio}
          onChangeText={(bio) => updateUser({ bio })}
          multiline
          placeholder="Deux lignes sur ta façon de lire."
        />
        <Text variant="small">{user.email ?? 'Connexion sans e-mail (compte local)'}</Text>
      </Card>

      <SectionHeader title="Synchronisation" />
      <SyncCard />

      <SectionHeader title="Abonnement" />
      <Card onPress={() => router.push('/premium')}>
        <Text variant="label">{user.premium ? `Premium ${user.plan ?? ''}` : 'Plan gratuit'}</Text>
        <Text variant="small">
          {user.premium
            ? 'Gérer ou résilier ton abonnement.'
            : '15 transcriptions IA par mois. Passer en Premium pour l’illimité.'}
        </Text>
      </Card>

      <SectionHeader title="Notifications" />
      <Card>
        <Toggle
          label="Nouveaux chapitres Wattpad"
          value={notifs.wattpad}
          onChange={(wattpad) => setNotifs({ ...notifs, wattpad })}
        />
        <Toggle
          label="Activité des clubs"
          value={notifs.clubs}
          onChange={(clubs) => setNotifs({ ...notifs, clubs })}
        />
        <Toggle
          label="Nouveautés des thèmes suivis"
          value={notifs.themes}
          onChange={(themes) => setNotifs({ ...notifs, themes })}
        />
        <Toggle
          label="Rappels de lecture"
          value={notifs.reminders}
          onChange={(reminders) => setNotifs({ ...notifs, reminders })}
          last
        />
      </Card>

      <SectionHeader title="Confidentialité" />
      <Card>
        <Text variant="overline" style={styles.label}>
          VISIBILITÉ PAR DÉFAUT DE MES CITATIONS
        </Text>
        <Segmented
          options={[
            { value: 'privee', label: '🔒 Privée' },
            { value: 'publique', label: '🌍 Publique' },
          ]}
          value={user.defaultQuoteVisibility}
          onChange={(defaultQuoteVisibility: Visibility) => updateUser({ defaultQuoteVisibility })}
        />
        <View style={styles.toggleSpacing}>
          <Toggle
            label="Afficher ma progression aux clubs"
            value={user.shareProgress}
            onChange={(shareProgress) => updateUser({ shareProgress })}
            last
          />
        </View>
        <Text variant="small" style={styles.privacyNote}>
          Les photos de pages restent privées dans tous les cas : seule la citation transcrite, avec
          l’auteur et l’œuvre, peut être partagée publiquement (droit de courte citation).
        </Text>
      </Card>

      <SectionHeader title="Langue" />
      <Card>
        <Text variant="label">Français</Text>
        <Text variant="small">
          D’autres langues arrivent : l’app est construite pour être traduite.
        </Text>
      </Card>

      <SectionHeader title="Mes thèmes" />
      <View style={styles.chips}>
        {ONBOARDING_THEMES.map((t) => (
          <Chip
            key={t.slug}
            label={`${t.emoji} #${t.slug}`}
            selected={user.followedThemes.includes(t.slug)}
            onPress={() => toggleFollowedTheme(t.slug)}
          />
        ))}
      </View>

      <SectionHeader title="Mes données (RGPD)" />
      <Button
        label="⬇️ Exporter toutes mes données"
        variant="secondary"
        loading={exporting}
        onPress={exportData}
        style={styles.action}
      />
      <Button label="Supprimer mon compte" variant="danger" onPress={deleteAccount} style={styles.action} />

      <SectionHeader title="Aide" />
      <Card>
        <Text variant="body">Une question, un bug, une idée ? Écris-nous à bonjour@manent.app.</Text>
      </Card>

      <Button
        label="Se déconnecter"
        variant="ghost"
        onPress={() =>
          Alert.alert('Se déconnecter ?', 'Tes données restent sur cet appareil.', [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Se déconnecter',
              onPress: () => {
                useStore.setState({ onboarded: false });
                router.replace('/onboarding/bienvenue');
              },
            },
          ])
        }
        style={styles.logout}
      />
    </Screen>
  );
}

/** État de la synchronisation, et déclenchement manuel. */
function SyncCard() {
  const outbox = useStore((s) => s.outbox);
  const lastSyncedAt = useStore((s) => s.lastSyncedAt);
  const syncing = useStore((s) => s.syncing);
  const sync = useStore((s) => s.sync);
  const configured = hasBackend();

  const run = async () => {
    const report = await sync();
    if (report.skipped === 'hors-ligne') {
      Alert.alert('Pas de backend', "Cette installation fonctionne en local : rien à synchroniser.");
      return;
    }
    if (report.skipped === 'non-connecte') {
      Alert.alert('Connexion requise', 'Connecte-toi pour retrouver tes lectures sur tes appareils.');
      return;
    }
    if (report.rejected.length > 0) {
      Alert.alert(
        'Synchronisation partielle',
        `${report.rejected.length} modification(s) n'ont pas pu partir. Elles repartiront au prochain passage.`,
      );
      return;
    }
    Alert.alert(
      'À jour',
      `${report.pushed} envoyée(s), ${report.pulled} reçue(s).`,
    );
  };

  return (
    <Card>
      <Text variant="label">
        {configured ? 'Sauvegarde et partage entre appareils' : 'Mode local'}
      </Text>
      <Text variant="small" style={styles.syncLine}>
        {configured
          ? lastSyncedAt
            ? `Dernier passage ${timeAgo(lastSyncedAt)}.`
            : 'Jamais synchronisé pour l’instant.'
          : 'Tes données restent sur cet appareil. Configure un backend pour les retrouver ailleurs.'}
      </Text>
      {outbox.length > 0 ? (
        <Text variant="small" color={colors.amber} style={styles.syncLine}>
          {outbox.length} modification(s) en attente d’envoi.
        </Text>
      ) : null}
      <Button
        label="Synchroniser maintenant"
        variant="secondary"
        loading={syncing}
        disabled={!configured}
        onPress={run}
        style={styles.syncButton}
      />
    </Card>
  );
}

function Toggle({
  label, value, onChange, last,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.toggleRow, last && styles.toggleRowLast]}
    >
      <Text variant="body" style={styles.toggleLabel}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.green, false: colors.rule }}
        thumbColor={colors.white}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm },
  syncLine: { marginTop: spacing.xs },
  syncButton: { marginTop: spacing.md },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLabel: { flex: 1, paddingRight: spacing.md },
  toggleSpacing: { marginTop: spacing.md },
  privacyNote: { marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  action: { marginBottom: spacing.sm },
  logout: { marginTop: spacing.xl },
});
