import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/src/theme';

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center' }} testID="root-loader">
      <ActivityIndicator color={colors.chambray} />
    </View>
  );
}
