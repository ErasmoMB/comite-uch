// app/(app)/consultas.tsx
import { useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Input } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { ApiError } from '../../src/lib/http'
import { chatService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'
import type { MensajeChatDto } from '../../src/types/api'

const INTERVALO_POLLING = 4000

export default function Consultas() {
  const { usuario } = useApp()
  const [mensajes, setMensajes] = useState<MensajeChatDto[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    let activo = true
    async function refrescar() {
      try {
        const lista = await chatService.getMiHilo()
        if (activo) setMensajes(lista)
      } catch {
        // si falla un ciclo de polling, se reintenta en el siguiente sin romper la UI
      }
    }
    refrescar()
    const t = setInterval(refrescar, INTERVALO_POLLING)
    return () => {
      activo = false
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes.length])

  async function onEnviar() {
    const contenido = texto.trim()
    if (!contenido || enviando) return
    setEnviando(true)
    setError('')
    try {
      const nuevo = await chatService.enviarComoSolicitante(contenido)
      setMensajes(prev => [...prev, nuevo])
      setTexto('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  function esMio(m: MensajeChatDto) {
    return m.esDeSecretaria === undefined ? m.autorId === usuario?.id : !m.esDeSecretaria
  }

  function hora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>ST</Text>
          </View>
          <View>
            <Text style={s.headerTitulo}>Secretaría técnica</Text>
            <Text style={s.headerEstado}>En línea</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.dia}>Hoy</Text>
          {mensajes.map(m => (
            <View key={m.id} style={[s.bubble, esMio(m) ? s.bubbleMe : s.bubbleThem]}>
              <Text style={esMio(m) ? s.bubbleTextMe : s.bubbleTextThem}>{m.texto}</Text>
              <Text style={[s.hora, esMio(m) ? s.horaMe : s.horaThem]}>{hora(m.createdAt)}</Text>
            </View>
          ))}
          {mensajes.length === 0 && (
            <Text style={s.vacio}>Aún no tienes mensajes con secretaría.</Text>
          )}
        </ScrollView>

        {!!error && <Text style={s.error}>{error}</Text>}

        <View style={s.footer}>
          <Input
            style={s.input}
            placeholder="Escribe un mensaje…"
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={onEnviar}
            returnKeyType="send"
          />
          <Pressable
            onPress={onEnviar}
            disabled={enviando}
            style={[s.sendBtn, enviando && s.sendBtnDisabled]}
          >
            <Text style={s.sendBtnText}>➤</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2f7' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerTitulo: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  headerEstado: { fontSize: 11, fontWeight: '500', color: colors.success },
  body: { flex: 1 },
  bodyContent: { padding: 14, gap: 8 },
  dia: { textAlign: 'center', fontSize: 11.5, fontWeight: '500', color: colors.slate400, marginBottom: 4 },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.lineSoft },
  bubbleTextMe: { color: '#fff', fontSize: 14 },
  bubbleTextThem: { color: colors.ink, fontSize: 14 },
  hora: { fontSize: 10, alignSelf: 'flex-end' },
  horaMe: { color: 'rgba(255,255,255,0.75)' },
  horaThem: { color: colors.slate400 },
  vacio: { textAlign: 'center', fontSize: 13, color: colors.slate500, marginTop: 20 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '500', marginHorizontal: 12 },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, borderRadius: 999 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 17 },
})
