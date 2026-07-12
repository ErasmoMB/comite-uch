// app/registro-exito.tsx
import { Link, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../src/lib/theme'

export default function RegistroExito() {
  const { correo } = useLocalSearchParams<{ correo?: string }>()
  return (
    <View style={s.wrap}>
      <View style={s.check}><Text style={s.checkMark}>✓</Text></View>
      <Text style={s.h2}>¡Cuenta creada!</Text>
      <Text style={s.p}>Tu cuenta fue registrada con el correo <Text style={{ fontWeight: '700', color: colors.ink }}>{correo ?? 'usuario@uch.pe'}</Text>. Ya puedes iniciar sesión y enviar tu primer proyecto.</Text>
      <Link href="/login" style={s.btn}>Ir al inicio de sesión</Link>
    </View>
  )
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  check: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  checkMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 22, fontWeight: '700', overflow: 'hidden' },
  h2: { fontSize: 21, color: colors.navy, fontWeight: '700' },
  p: { fontSize: 14.5, lineHeight: 22, color: colors.slate500, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, color: '#fff', fontWeight: '700', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 10, overflow: 'hidden', marginTop: 12 },
})
