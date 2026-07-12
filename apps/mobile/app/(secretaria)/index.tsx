// app/(secretaria)/index.tsx
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, ErrorText, Input, Loading, StatusBadge } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import { colors } from '../../src/lib/theme'
import { formatearFecha } from '../../src/lib/dates'
import { ApiError } from '../../src/lib/http'
import { filtrarBandeja } from '../../src/lib/bandejaFilter'
import { expedientesService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'
import type { ExpedienteDto } from '../../src/types/api'

export default function Bandeja() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [expedientes, setExpedientes] = useState<ExpedienteDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const lista = await expedientesService.list()
        if (activo) setExpedientes(lista)
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la bandeja de expedientes.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  const pendientes = useMemo(
    () => filtrarBandeja(expedientes, { busqueda, fechaDesde, fechaHasta }),
    [expedientes, busqueda, fechaDesde, fechaHasta],
  )

  function limpiarFiltros() {
    setBusqueda('')
    setFechaDesde('')
    setFechaHasta('')
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerTitle}>Bandeja de expedientes</Text>
        <Pressable onPress={() => router.push('/(secretaria)/perfil')}>
          <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} size={40} />
        </Pressable>
      </View>

      <View style={s.filtros}>
        <Input
          placeholder="Buscar por código, título o remitente…"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input style={{ flex: 1 }} placeholder="Desde AAAA-MM-DD" value={fechaDesde} onChangeText={setFechaDesde} autoCapitalize="none" />
          <Input style={{ flex: 1 }} placeholder="Hasta AAAA-MM-DD" value={fechaHasta} onChangeText={setFechaHasta} autoCapitalize="none" />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.contador}>
            {cargando ? 'Cargando…' : `${pendientes.length} expediente(s) pendiente(s)`}
          </Text>
          <Pressable onPress={limpiarFiltros}><Text style={s.limpiar}>Limpiar</Text></Pressable>
        </View>
      </View>

      <View style={s.lista}>
        {cargando && <Loading label="Cargando bandeja…" />}
        {!cargando && !!error && <View style={{ padding: 14 }}><ErrorText>{error}</ErrorText></View>}
        {!cargando && !error && pendientes.map(e => (
          <Pressable key={e.id} onPress={() => router.push(`/(secretaria)/revision/${e.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Text numberOfLines={1} style={s.titulo}>{e.tituloProtocolo}</Text>
                <StatusBadge estado={e.estado} />
              </View>
              <Text style={s.remitente}>{e.investigadorNombre ?? 'Solicitante desconocido'}</Text>
              <Text style={s.meta}>{(e.codigoUnico ?? '—')} · {formatearFecha(e.fechaEnvio)}</Text>
            </Card>
          </Pressable>
        ))}
        {!cargando && !error && pendientes.length === 0 && (
          <Text style={s.vacio}>No hay expedientes pendientes de gestión administrativa.</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  filtros: { padding: 16, gap: 10 },
  contador: { fontSize: 12.5, fontWeight: '500', color: colors.slate400 },
  limpiar: { fontSize: 13, fontWeight: '600', color: colors.primary },
  lista: { paddingHorizontal: 16, gap: 10, flex: 1 },
  titulo: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  remitente: { fontSize: 12.5, fontWeight: '500', color: colors.slate500, marginBottom: 4 },
  meta: { fontSize: 12, fontWeight: '500', color: colors.slate400 },
  vacio: { textAlign: 'center', fontSize: 13.5, color: colors.slate500, marginTop: 24 },
})
