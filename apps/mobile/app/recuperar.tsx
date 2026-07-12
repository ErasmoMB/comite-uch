// app/recuperar.tsx
import { useRef, useState } from 'react'
import { Link, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Button, ErrorText, Field, Input, Screen } from '../src/components/ui'
import { colors } from '../src/lib/theme'
import { ApiError } from '../src/lib/http'
import { authService } from '../src/services'

function Progreso({ actual }: { actual: number }) {
  return (
    <View style={s.progreso}>
      {[1, 2, 3, 4].map(n => (
        <View key={n} style={s.progresoItem}>
          {n > 1 && <View style={[s.progresoBar, n <= actual && s.progresoBarActiva]} />}
          <View style={[s.progresoDot, n <= actual && s.progresoDotActiva]}>
            <Text style={[s.progresoDotText, n <= actual && s.progresoDotTextActiva]}>{n < actual ? '✓' : n}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

export default function Recuperar() {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [correo, setCorreo] = useState('')
  const [codigo, setCodigo] = useState(['', '', '', '', '', ''])
  const [clave, setClave] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)
  const refs = useRef<Array<TextInput | null>>([])

  async function siguiente() {
    setError('')
    if (paso === 1) {
      if (!correo.trim()) return setError('Ingresa tu correo institucional.')
      setEnviando(true)
      try {
        await authService.solicitarRecuperacion(correo.trim())
        setPaso(2)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo enviar el código. Intenta nuevamente.')
      } finally {
        setEnviando(false)
      }
    } else if (paso === 2) {
      if (codigo.some(d => d === '')) return setError('Completa los 6 dígitos del código.')
      setEnviando(true)
      try {
        await authService.verificarCodigoRecuperacion(correo.trim(), codigo.join(''))
        setPaso(3)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Código inválido o vencido.')
      } finally {
        setEnviando(false)
      }
    } else if (paso === 3) {
      if (clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
      if (clave !== confirmar) return setError('Las contraseñas no coinciden.')
      setEnviando(true)
      try {
        await authService.cambiarPasswordRecuperacion(correo.trim(), codigo.join(''), clave)
        setPaso(4)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la contraseña. Intenta nuevamente.')
      } finally {
        setEnviando(false)
      }
    }
  }

  async function reenviarCodigo() {
    setError('')
    setReenviado(false)
    setEnviando(true)
    try {
      await authService.solicitarRecuperacion(correo.trim())
      setReenviado(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reenviar el código.')
    } finally {
      setEnviando(false)
    }
  }

  function onDigito(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1)
    setCodigo(prev => prev.map((c, j) => (j === i ? d : c)))
    if (d && i < 5) refs.current[i + 1]?.focus()
  }

  function onKeyPress(i: number, key: string) {
    if (key === 'Backspace' && !codigo[i] && i > 0) refs.current[i - 1]?.focus()
  }

  return (
    <Screen>
      <Text style={s.title}>Recuperar contraseña</Text>
      <Progreso actual={paso} />

      {paso === 1 && (
        <>
          <Text style={s.h2}>Ingresa tu correo</Text>
          <Text style={s.p}>Te enviaremos un código de verificación a tu correo institucional.</Text>
          <Field label="Correo institucional">
            <Input placeholder="usuario@uch.pe" autoCapitalize="none" keyboardType="email-address" value={correo} onChangeText={setCorreo} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button title={enviando ? 'Enviando…' : 'Enviar código'} loading={enviando} onPress={siguiente} />
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={s.h2}>Ingresa el código</Text>
          <Text style={s.p}>Enviamos un código de 6 dígitos a tu correo institucional.</Text>
          <View style={s.otpRow}>
            {codigo.map((d, i) => (
              <TextInput
                key={i}
                ref={el => { refs.current[i] = el }}
                style={[s.otpBox, d ? s.otpBoxFilled : undefined]}
                keyboardType="number-pad"
                maxLength={1}
                value={d}
                onChangeText={v => onDigito(i, v)}
                onKeyPress={e => onKeyPress(i, e.nativeEvent.key)}
                textAlign="center"
              />
            ))}
          </View>
          <Pressable onPress={reenviarCodigo} disabled={enviando} style={s.reenviarWrap}>
            <Text style={s.reenviarText}>¿No llegó? <Text style={s.reenviarLink}>Reenviar código</Text></Text>
          </Pressable>
          {reenviado && !error && <Text style={s.exito}>Código reenviado. Revisa tu correo.</Text>}
          <ErrorText>{error}</ErrorText>
          <Button title={enviando ? 'Verificando…' : 'Verificar código'} loading={enviando} onPress={siguiente} />
        </>
      )}

      {paso === 3 && (
        <>
          <Text style={s.h2}>Nueva contraseña</Text>
          <Text style={s.p}>Crea una nueva contraseña para tu cuenta.</Text>
          <Field label="Nueva contraseña">
            <Input placeholder="••••••" secureTextEntry value={clave} onChangeText={setClave} />
          </Field>
          <Field label="Confirmar contraseña">
            <Input placeholder="••••••" secureTextEntry value={confirmar} onChangeText={setConfirmar} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button title={enviando ? 'Guardando…' : 'Guardar contraseña'} loading={enviando} onPress={siguiente} />
        </>
      )}

      {paso === 4 && (
        <View style={s.exitoWrap}>
          <View style={s.check}><Text style={s.checkMark}>✓</Text></View>
          <Text style={s.h2Centrado}>¡Contraseña actualizada!</Text>
          <Text style={s.pCentrado}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
          <Button title="Ir al inicio de sesión" onPress={() => router.replace('/login')} />
        </View>
      )}

      {paso < 4 && (
        <Link href="/login" style={s.volver}>Volver al inicio de sesión</Link>
      )}
    </Screen>
  )
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: colors.navy, textAlign: 'center', marginBottom: 6 },
  progreso: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  progresoItem: { flexDirection: 'row', alignItems: 'center' },
  progresoBar: { width: 28, height: 2, backgroundColor: colors.line },
  progresoBarActiva: { backgroundColor: colors.primary },
  progresoDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue50 },
  progresoDotActiva: { backgroundColor: colors.primary },
  progresoDotText: { fontSize: 12, fontWeight: '700', color: colors.slate400 },
  progresoDotTextActiva: { color: '#fff' },
  h2: { fontSize: 18, color: colors.navy, fontWeight: '700', marginBottom: 8 },
  h2Centrado: { fontSize: 20, color: colors.navy, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  p: { fontSize: 13.5, lineHeight: 20, color: colors.slate500, marginBottom: 16 },
  pCentrado: { fontSize: 14, lineHeight: 22, color: colors.slate500, textAlign: 'center', marginBottom: 20 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  otpBox: { width: 44, height: 52, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', fontSize: 20, fontWeight: '700', color: colors.ink },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: colors.blue50 },
  reenviarWrap: { marginBottom: 14 },
  reenviarText: { textAlign: 'center', fontSize: 13.5, color: colors.slate500 },
  reenviarLink: { color: colors.primary, fontWeight: '600' },
  exito: { textAlign: 'center', fontSize: 13, color: colors.success, marginBottom: 14 },
  exitoWrap: { alignItems: 'center', paddingTop: 12, gap: 4 },
  check: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  checkMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 22, fontWeight: '700', overflow: 'hidden' },
  volver: { textAlign: 'center', color: colors.primary, fontSize: 14, fontWeight: '600', marginTop: 18 },
})
