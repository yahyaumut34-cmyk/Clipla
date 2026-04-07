import { View, Text } from 'react-native';
import { C } from '../shared/theme';

export function Badge({ label, color = C.accent }) {
  return (
    <View style={{
      borderWidth: 1,
      borderColor: color + '40',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
      alignSelf: 'flex-start',
      backgroundColor: color + '12',
    }}>
      <Text style={{ color, fontSize: 10, letterSpacing: 1.5 }}>{label}</Text>
    </View>
  );
}
