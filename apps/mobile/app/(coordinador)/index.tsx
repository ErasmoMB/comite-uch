// app/(coordinador)/index.tsx
import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Badge, Card, ErrorText, Input, Loading, Screen, StatusBadge } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import DateField, { parseFechaISO } from '../../src/components/DateField'
import { colors } from '../../src/lib/theme'
import { formatearFecha } from '../../src/lib/dates'
import { ApiError } from '../../src/lib/http'
import { filtrarEnRevision } from '../../src/lib/coordinadorFilter'
import { evaluacionService, expedientesService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'
import type { EvaluacionDto, ExpedienteDto } from '../../src/types/api'

export default function DashboardCoordinador() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [expedientes, setExpedientes] = useState<ExpedienteDto[]>([])
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const cargar = useCallback(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const [exps, evals] = await Promise.all([
          expedientesService.list(0, 500),
          evaluacionService.list(0, 500),
        ])
        if (activo) {
          setExpedientes(exps)
          setEvaluaciones(evals)
        }
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los expedientes.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  // useFocusEffect (NO useEffect mount-only): al volver de Asignación, Tabs
  // mantiene esta pantalla montada, así que hay que recargar en cada focus para
  // reflejar la asignación recién hecha (lección de la verificación de Fase 4).
  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar])
  )

  // Stats sobre TODOS los expedientes (no solo los en_revision), igual que la web.
  const stats = useMemo(() => [
    { n: expedientes.filter(e => e.estado === 'en_revision').length, label: 'En revisión', color: colors.primary },
    { n: expedientes.filter(e => e.estado === 'aprobado' || e.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: colors.success },
    { n: expedientes.filter(e => e.estado === 'no_aprobado').length, label: 'No aprobados', color: colors.danger },
    { n: expedientes.filter(e => e.estado === 'subsanacion').length, label: 'Subsanación', color: colors.warn },
  ], [expedientes])

  const idsConEvaluacion = useMemo(
    () => new Set(evaluaciones.map(e => e.expedienteId)),
    [evaluaciones],
  )

  const pendientes = useMemo(
    () => filtrarEnRevision(expedientes, { busqueda, fechaDesde, fechaHasta }),
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
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={s.headerKicker}>Panel de coordinación</Text>
          <Text numberOfLines={1} style={s.headerTitle}>{usuario?.nombres} {usuario?.apellidos}</Text>
        </View>
        <Pressable onPress={() => router.push('/(coordinador)/perfil')}>
          <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} size={40} />
        </Pressable>
      </View>

      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {stats.map(st => (
            <Card key={st.label} style={{ flexBasis: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 11 }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: st.color }}>{st.n}</Text>
              <Text style={{ fontSize: 11, color: colors.slate500 }}>{st.label}</Text>
            </Card>
          ))}
        </View>

        <Input
          placeholder="Buscar por código, título o estudiante…"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <DateField style={{ flex: 1 }} placeholder="Desde" value={fechaDesde} onChange={setFechaDesde} maximumDate={parseFechaISO(fechaHasta) ?? undefined} />
          <DateField style={{ flex: 1 }} placeholder="Hasta" value={fechaHasta} onChange={setFechaHasta} minimumDate={parseFechaISO(fechaDesde) ?? undefined} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.contador}>
            {cargando ? 'Cargando…' : `Expedientes en revisión (${pendientes.length})`}
          </Text>
          <Pressable onPress={limpiarFiltros}><Text style={s.limpiar}>Limpiar</Text></Pressable>
        </View>

        <View style={{ gap: 10 }}>
          {cargando && <Loading label="Cargando expedientes…" />}
          {!cargando && !error && pendientes.map(e => {
            const asignado = idsConEvaluacion.has(e.id)
            return (
              <Pressable key={e.id} onPress={() => router.push(`/(coordinador)/asignacion/${e.id}`)}>
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Text numberOfLines={1} style={s.titulo}>{e.tituloProtocolo}</Text>
                    <StatusBadge estado={e.estado} />
                  </View>
                  <Text style={s.investigador}>{e.investigadorNombre ?? 'Solicitante desconocido'}</Text>
                  <Text style={s.meta}>{(e.codigoUnico ?? '—')} · {formatearFecha(e.fechaEnvio)}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    {asignado
                      ? <Badge label="En evaluación" bg={colors.successBg} fg={colors.success} />
                      : <Badge label="Pendiente de asignar" bg={colors.warnBg} fg={colors.warn} />}
                    <Text style={s.accion}>{asignado ? 'Ver asignación ›' : 'Asignar evaluador ›'}</Text>
                  </View>
                </Card>
              </Pressable>
            )
          })}
          {!cargando && !error && pendientes.length === 0 && (
            <Text style={s.vacio}>No hay expedientes en revisión por el momento.</Text>
          )}
        </View>
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerKicker: { fontSize: 12.5, color: colors.slate500 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  contador: { fontSize: 13, fontWeight: '700', color: colors.navy },
  limpiar: { fontSize: 13, fontWeight: '600', color: colors.primary },
  titulo: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  investigador: { fontSize: 12.5, fontWeight: '500', color: colors.slate500, marginBottom: 4 },
  meta: { fontSize: 12, fontWeight: '500', color: colors.slate400 },
  accion: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  vacio: { textAlign: 'center', fontSize: 13.5, color: colors.slate500, marginTop: 24 },
})
