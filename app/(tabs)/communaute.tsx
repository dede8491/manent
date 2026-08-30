import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen, Segmented, Text } from '@/components';
import { BoardsPane } from '@/features/community/BoardsPane';
import { ClubsPane } from '@/features/community/ClubsPane';
import { spacing } from '@/theme';

type Pane = 'tableaux' | 'clubs';

export default function Communaute() {
  const router = useRouter();
  const [pane, setPane] = useState<Pane>('tableaux');

  return (
    <Screen tabBarPadding>
      <View style={styles.head}>
        <Text variant="title">Communauté</Text>
        <Text variant="bodySoft">Ce que les lectures des autres laissent derrière elles.</Text>
      </View>

      <Segmented
        options={[
          { value: 'tableaux', label: '📌 Tableaux' },
          { value: 'clubs', label: '📖 Clubs de lecture' },
        ]}
        value={pane}
        onChange={setPane}
      />

      <View style={styles.pane}>
        {pane === 'tableaux' ? <BoardsPane router={router} /> : <ClubsPane router={router} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: spacing.lg },
  pane: { marginTop: spacing.lg },
});
