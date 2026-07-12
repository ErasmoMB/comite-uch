// src/components/TopBar.tsx
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../lib/theme'

export default function TopBar({ titulo, atras = true, right }: { titulo: string; atras?: boolean; right?: ReactNode }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.bar, { paddingTop: insets.top + 14 }]}>
      {atras && (
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
      )}
      <Text style={s.title} numberOfLines={1}>{titulo}</Text>
      {right}
    </View>
  )
}
const s = StyleSheet.create({
  bar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.slate500, lineHeight: 30 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
})
