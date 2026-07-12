// src/components/Avatar.tsx
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '../lib/theme'

function iniciales(nombres?: string, apellidos?: string) {
  return `${nombres?.[0] ?? ''}${apellidos?.[0] ?? ''}`.toUpperCase() || 'U'
}

export default function Avatar({
  nombres, apellidos, size = 40, style,
}: { nombres?: string; apellidos?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Text style={{ color: '#fff', fontSize: size * 0.34, fontWeight: '700' }}>{iniciales(nombres, apellidos)}</Text>
    </View>
  )
}
const s = StyleSheet.create({
  avatar: { backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
})
