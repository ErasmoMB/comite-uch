// app/(secretaria)/chat/[solicitanteId].tsx
import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Input } from '../../../src/components/ui'
import { colors } from '../../../src/lib/theme'
import { ApiError } from '../../../src/lib/http'
import { chatService } from '../../../src/services'
import type { MensajeChatDto } from '../../../src/types/api'

const INTERVALO_POLLING = 4000

function iniciales(nombreCompleto?: string) {
  const partes = (nombreCompleto ?? '').trim().split(/\s+/)
  return `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}`.toUpperCase() || 'U'
}

export default function ChatHilo() {
  const { solicitanteId, nombre, detalle } = useLocalSearchParams<{ solicitanteId: string; nombre?: string; detalle?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const id = Number(solicitanteId)
  const [mensajes, setMensajes] = useState<MensajeChatDto[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (Number.isNaN(id)) return
    let activo = true
    async function refrescar() {
      try {
        const lista = await chatService.getHiloDeSolicitante(id)
        if (activo) setMensajes(lista)
      } catch {
        // si falla un ciclo de polling, se reintenta en el siguiente
      }
    }
    refrescar()
    const t = setInterval(refrescar, INTERVALO_POLLING)
    return () => { activo = false; clearInterval(t) }
  }, [id])

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes.length])

  async function onEnviar() {
    const contenido = texto.trim()
    if (!contenido || enviando || Number.isNaN(id)) return
    setEnviando(true)
    setError('')
    try {
      const nuevo = await chatService.enviarComoSecretaria(id, contenido)
      setMensajes(prev => [...prev, nuevo])
      setTexto('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  function esMio(m: MensajeChatDto) {
    return !!m.esDeSecretaria
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
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}><Text style={s.backText}>‹</Text></Pressable>
          <View style={s.avatar}><Text style={s.avatarText}>{iniciales(nombre)}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={s.headerTitulo}>{nombre || 'Solicitante'}</Text>
            {!!detalle && <Text numberOfLines={1} style={s.headerDetalle}>{detalle}</Text>}
          </View>
        </View>

        <ScrollView ref={scrollRef} style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {mensajes.map(m => (
            <View key={m.id} style={[s.bubble, esMio(m) ? s.bubbleMe : s.bubbleThem]}>
              <Text style={esMio(m) ? s.bubbleTextMe : s.bubbleTextThem}>{m.texto}</Text>
              <Text style={[s.hora, esMio(m) ? s.horaMe : s.horaThem]}>{hora(m.createdAt)}</Text>
            </View>
          ))}
          {mensajes.length === 0 && (
            <Text style={s.vacio}>Aún no hay mensajes en esta conversación. Escribe el primero.</Text>
          )}
        </ScrollView>

        {!!error && <Text style={s.error}>{error}</Text>}

        <View style={s.footer}>
          <Input style={s.input} placeholder="Escribe un mensaje…" value={texto} onChangeText={setTexto} onSubmitEditing={onEnviar} returnKeyType="send" />
          <Pressable onPress={onEnviar} disabled={enviando} style={[s.sendBtn, enviando && s.sendBtnDisabled]}>
            <Text style={s.sendBtnText}>➤</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2f7' },
  header: { backgroundColor: '#fff', paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  back: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.slate500, lineHeight: 30 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerTitulo: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  headerDetalle: { fontSize: 11, fontWeight: '500', color: colors.slate500 },
  body: { flex: 1 },
  bodyContent: { padding: 14, gap: 8 },
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
  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderRadius: 999 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 17 },
})
