// app/(secretaria)/chat/index.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen, ErrorText, Loading } from '../../../src/components/ui'
import { colors } from '../../../src/lib/theme'
import { ApiError } from '../../../src/lib/http'
import { ROL_LABEL } from '../../../src/data/types'
import { chatService } from '../../../src/services'
import type { ConversacionChatDto, RolBackend, SolicitanteChatDto } from '../../../src/types/api'

const INTERVALO_CONVERSACIONES = 10000

function iniciales(nombreCompleto?: string) {
  const partes = (nombreCompleto ?? '').trim().split(/\s+/)
  return `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}`.toUpperCase() || 'U'
}

// Encabezado del hilo: tipo + código (si aplica) + correo.
function detalleSolicitante(s: { rol: RolBackend; codigoEstudiante: string | null; email: string }): string {
  const partes = [ROL_LABEL[s.rol] ?? s.rol]
  if (s.codigoEstudiante) partes.push(`Código ${s.codigoEstudiante}`)
  partes.push(s.email)
  return partes.join(' · ')
}

// Línea bajo el nombre en la lista (solo estudiantes tienen código).
function subInfo(rol: RolBackend, codigoEstudiante: string | null): string {
  if (!codigoEstudiante) return ''
  return `Código ${codigoEstudiante} · ${ROL_LABEL[rol] ?? rol}`
}

function formatearHora(fecha: string | null) {
  if (!fecha) return ''
  return new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatLista() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [conversaciones, setConversaciones] = useState<ConversacionChatDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [solicitantes, setSolicitantes] = useState<SolicitanteChatDto[]>([])
  const [cargandoSolicitantes, setCargandoSolicitantes] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const lista = await chatService.getConversaciones()
        if (activo) { setConversaciones(lista); setError('') }
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las conversaciones.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    const t = setInterval(cargar, INTERVALO_CONVERSACIONES)
    return () => { activo = false; clearInterval(t) }
  }, [])

  async function abrirNuevo() {
    setMostrarNuevo(true)
    if (solicitantes.length === 0) {
      try {
        setCargandoSolicitantes(true)
        const lista = await chatService.getSolicitantes()
        setSolicitantes(lista)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de solicitantes.')
      } finally {
        setCargandoSolicitantes(false)
      }
    }
  }

  function irAlHilo(solicitanteId: number, nombre: string, detalle: string) {
    router.push({ pathname: '/(secretaria)/chat/[solicitanteId]', params: { solicitanteId: String(solicitanteId), nombre, detalle } })
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerTitle}>Chat</Text>
        <Pressable onPress={abrirNuevo}><Text style={s.nuevo}>+ Nuevo</Text></Pressable>
      </View>

      <Screen style={{ padding: 0, gap: 0 }}>
        {!!error && <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><ErrorText>{error}</ErrorText></View>}
        {cargando && <Loading label="Cargando conversaciones…" />}

        {!cargando && conversaciones.map(c => (
          <Pressable key={c.solicitanteId} style={s.convRow} onPress={() => irAlHilo(c.solicitanteId, c.nombre, detalleSolicitante(c))}>
            <View style={s.avatar}><Text style={s.avatarText}>{iniciales(c.nombre)}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                <Text numberOfLines={1} style={s.convNombre}>{c.nombre}</Text>
                <Text style={s.convHora}>{formatearHora(c.ultimaFecha)}</Text>
              </View>
              {!!subInfo(c.rol, c.codigoEstudiante) && <Text numberOfLines={1} style={s.convSub}>{subInfo(c.rol, c.codigoEstudiante)}</Text>}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                <Text numberOfLines={1} style={s.convPreview}>{c.ultimoMensaje ?? 'Sin mensajes'}</Text>
                {c.noLeidos > 0 && <View style={s.badge}><Text style={s.badgeText}>{c.noLeidos}</Text></View>}
              </View>
            </View>
          </Pressable>
        ))}
        {!cargando && conversaciones.length === 0 && !error && (
          <Text style={s.vacio}>Aún no hay conversaciones. Usa "+ Nuevo" para escribirle a un solicitante.</Text>
        )}
      </Screen>

      <Modal visible={mostrarNuevo} transparent animationType="slide" onRequestClose={() => setMostrarNuevo(false)}>
        <Pressable style={s.backdrop} onPress={() => setMostrarNuevo(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>Nueva conversación</Text>
            {cargandoSolicitantes && <Loading label="Cargando solicitantes…" />}
            {!cargandoSolicitantes && (
              <ScrollView>
                {solicitantes.map(so => (
                  <Pressable
                    key={so.id}
                    style={s.pickerRow}
                    onPress={() => { setMostrarNuevo(false); irAlHilo(so.id, so.nombre, detalleSolicitante(so)) }}
                  >
                    <Text style={s.pickerNombre}>{so.nombre}</Text>
                    <Text style={s.pickerDetalle}>{detalleSolicitante(so)}</Text>
                  </Pressable>
                ))}
                {solicitantes.length === 0 && (
                  <Text style={s.vacio}>No hay solicitantes disponibles.</Text>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  nuevo: { fontSize: 14, fontWeight: '600', color: colors.primary },
  convRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  convNombre: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.ink },
  convHora: { fontSize: 10.5, color: colors.slate400 },
  convSub: { fontSize: 10.5, fontWeight: '500', color: colors.primary, marginTop: 1 },
  convPreview: { flex: 1, fontSize: 11.5, color: colors.slate500, marginTop: 1 },
  badge: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  vacio: { textAlign: 'center', fontSize: 13, color: colors.slate500, margin: 24 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,32,74,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, gap: 4, maxHeight: '70%' },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, marginBottom: 8 },
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  pickerNombre: { fontSize: 14, fontWeight: '600', color: colors.ink },
  pickerDetalle: { fontSize: 11.5, color: colors.slate500, marginTop: 2 },
})
