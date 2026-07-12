// app/login.tsx
import { useState } from 'react'
import { Link, useRouter, type Href } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Button, ErrorText, Field, Input, Logo } from '../src/components/ui'
import { colors } from '../src/lib/theme'
import { ApiError } from '../src/lib/http'
import { useApp } from '../src/state/AppContext'
import { homeGroupForRole } from '../src/lib/roles'

export default function Login() {
  const { login } = useApp()
  const router = useRouter()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit() {
    if (!correo.trim() || !clave) {
      setError('Ingresa tu correo institucional y contraseña.')
      return
    }
    setError('')
    setEnviando(true)
    try {
      const u = await login(correo.trim(), clave)
      // Cast: expo-router typed-routes solo conoce rutas existentes en app/.
      // '/(secretaria)' recién existe físicamente desde Fase 4 Task 2.
      router.replace(homeGroupForRole(u.rol) as Href)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.card}>
        <View style={s.header}>
          <Logo />
          <Text style={s.title}>Comité de Ética</Text>
          <Text style={s.subtitle}>UNIV. DE CIENCIAS Y HUMANIDADES</Text>
        </View>
        <Field label="Correo institucional">
          <Input placeholder="usuario@uch.pe" autoCapitalize="none" keyboardType="email-address" value={correo} onChangeText={setCorreo} />
        </Field>
        <Field label="Contraseña">
          <Input placeholder="••••••••" secureTextEntry value={clave} onChangeText={setClave} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button title={enviando ? 'Ingresando…' : 'Ingresar'} loading={enviando} onPress={onSubmit} />
        <View style={s.links}>
          <Link href="/registro" style={s.link}>Registrarse</Link>
          <Text style={{ color: colors.line }}>·</Text>
          <Link href="/recuperar" style={s.link}>Recuperar</Link>
        </View>
        <Link href="/acerca" style={s.acerca}>Acerca del Comité de Ética</Link>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.navy, justifyContent: 'center', padding: 22 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 14 },
  header: { alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { fontSize: 19, fontWeight: '700', color: colors.navy },
  subtitle: { fontSize: 10.5, fontWeight: '600', color: colors.slate500, letterSpacing: 1.2 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 6 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  acerca: { textAlign: 'center', color: colors.slate500, fontSize: 13, marginTop: 6 },
})
