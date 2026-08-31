import { View } from 'react-native';
import { colors } from '@/src/theme';
import ManentLoader from '@/src/components/ManentLoader';

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.glacier, alignItems: 'center', justifyContent: 'center' }} testID="root-loader">
      <ManentLoader size={48} />
    </View>
  );
}
