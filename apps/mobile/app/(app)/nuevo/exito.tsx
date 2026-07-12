// app/(app)/nuevo/exito.tsx
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Button } from '../../../src/components/ui'
import { colors } from '../../../src/lib/theme'

export default function NuevoProyectoExito() {
  const { codigo, id } = useLocalSearchParams<{ codigo?: string; id?: string }>()
  const router = useRouter()
  const codigoMostrado = codigo || '—'

  return (
    <View style={s.wrap}>
      <View style={s.checkOuter}>
        <View style={s.checkInner}>
          <Text style={s.checkMark}>✓</Text>
        </View>
      </View>

      <Text style={s.h2}>¡Proyecto enviado!</Text>
      <Text style={s.p}>
        Tu proyecto fue registrado y pasará a revisión administrativa. Recibirás notificaciones sobre su avance.
      </Text>

      <View style={s.codigoCard}>
        <Text style={s.codigoLabel}>CÓDIGO ASIGNADO</Text>
        <Text style={s.codigoValor}>{codigoMostrado}</Text>
      </View>

      <View style={{ width: '100%', gap: 10 }}>
        <Button
          title="Ver detalle del proyecto"
          onPress={() => (id ? router.replace(`/(app)/proyectos/${id}`) : router.replace('/(app)/proyectos'))}
        />
        <Button title="Ir al inicio" variant="outline" onPress={() => router.replace('/(app)')} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 26, gap: 4 },
  checkOuter: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  checkInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 21, color: colors.navy, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  p: { fontSize: 14, lineHeight: 22, color: colors.slate500, textAlign: 'center', marginBottom: 20 },
  codigoCard: { backgroundColor: colors.navy, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 18, alignItems: 'center', marginBottom: 24, width: '100%' },
  codigoLabel: { fontSize: 11, color: '#fff', opacity: 0.7, letterSpacing: 1, fontWeight: '600', marginBottom: 4 },
  codigoValor: { fontSize: 30, fontWeight: '700', letterSpacing: 1, color: '#fff' },
})
