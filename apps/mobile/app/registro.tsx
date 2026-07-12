// app/registro.tsx
import { useState } from 'react'
import { Link, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, ErrorText, Field, Input, Screen } from '../src/components/ui'
import { colors } from '../src/lib/theme'
import { ROL_LABEL, ROLES_AUTO_REGISTRO, type Rol } from '../src/data/types'
import { ApiError } from '../src/lib/http'
import { useApp } from '../src/state/AppContext'

const OPCIONES_ROL = ROLES_AUTO_REGISTRO.map(rol => ({ value: rol as Rol, label: ROL_LABEL[rol] }))

export default function Registro() {
  const { registrar } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [f, setF] = useState({ nombres: '', apellidos: '', correo: '', rol: OPCIONES_ROL[0].value, codigo: '', clave: '', confirmar: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esEstudiante = f.rol === 'estudiante_pregrado' || f.rol === 'estudiante_postgrado'
  const esInvestigador = f.rol === 'investigador'
  const etiquetaCodigo = esInvestigador ? 'Laboratorio (opcional)' : 'Código de estudiante'
  const set = (k: keyof typeof f) => (v: string) => setF(prev => ({ ...prev, [k]: v }))

  async function onSubmit() {
    if (!f.nombres.trim() || !f.apellidos.trim() || !f.correo.trim() || !f.clave) return setError('Completa todos los campos obligatorios.')
    if (!/@uch\.(pe|edu\.pe)$/i.test(f.correo.trim())) return setError('Usa tu correo institucional (@uch.pe).')
    if (f.clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (f.clave !== f.confirmar) return setError('Las contraseñas no coinciden.')
    setError('')
    setEnviando(true)
    try {
      await registrar({
        nombre: f.nombres.trim(), apellido: f.apellidos.trim(), email: f.correo.trim(), password: f.clave, rol: f.rol,
        codigoEstudiante: esEstudiante ? f.codigo.trim() || undefined : undefined,
        laboratorio: esInvestigador ? f.codigo.trim() || undefined : undefined,
      })
      router.push({ pathname: '/registro-exito', params: { correo: f.correo.trim() } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} style={s.backBtn} hitSlop={8}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <Text style={s.headerTitle}>Crear cuenta</Text>
        <View style={s.backBtn} />
      </View>

      <Screen>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Field label="Nombres"><Input placeholder="María" value={f.nombres} onChangeText={set('nombres')} /></Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Apellidos"><Input placeholder="Fernández" value={f.apellidos} onChangeText={set('apellidos')} /></Field>
          </View>
        </View>

        <Field label="Correo institucional">
          <Input placeholder="usuario@uch.pe" autoCapitalize="none" keyboardType="email-address" value={f.correo} onChangeText={set('correo')} />
        </Field>

        <Field label="Rol">
          <View style={s.segment}>
            {OPCIONES_ROL.map(r => (
              <Pressable key={r.value} onPress={() => setF(prev => ({ ...prev, rol: r.value }))}
                style={[s.segItem, f.rol === r.value && s.segItemActive]}>
                <Text style={[s.segText, f.rol === r.value && s.segTextActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {(esEstudiante || esInvestigador) && (
          <Card style={{ backgroundColor: colors.blue50, borderColor: colors.blue100 }}>
            <Field label={etiquetaCodigo}>
              <Input value={f.codigo} onChangeText={set('codigo')} placeholder={esInvestigador ? 'Lab. Central' : '2021xxxxx'} />
            </Field>
          </Card>
        )}

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Field label="Contraseña"><Input placeholder="••••••" secureTextEntry value={f.clave} onChangeText={set('clave')} /></Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Confirmar"><Input placeholder="••••••" secureTextEntry value={f.confirmar} onChangeText={set('confirmar')} /></Field>
          </View>
        </View>

        <ErrorText>{error}</ErrorText>
        <Button title={enviando ? 'Creando cuenta…' : 'Crear cuenta'} loading={enviando} onPress={onSubmit} />
        <Text style={s.footerText}>
          ¿Ya tienes cuenta? <Link href="/login" style={s.footerLink}>Ingresar</Link>
        </Text>
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.lineSoft,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: colors.navy },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  row: { flexDirection: 'row', gap: 10 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 12.5, color: colors.slate500, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  footerText: { textAlign: 'center', fontSize: 13.5, color: colors.slate500 },
  footerLink: { color: colors.primary, fontSize: 13.5, fontWeight: '600' },
})
