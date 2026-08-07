// app/(evaluador)/index.tsx
import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Badge, Card, ErrorText, Input, Loading, Screen } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import { PuntoEstado } from '../../src/components/EstadoServidor'
import DateField, { parseFechaISO } from '../../src/components/DateField'
import { colors } from '../../src/lib/theme'
import { formatearFecha } from '../../src/lib/dates'
import { ApiError } from '../../src/lib/http'
import { filtrarEvaluacionesAsignadas, type FilaEvaluacion } from '../../src/lib/evaluacionBandejaFilter'
import { evaluacionService, expedientesService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'

export default function BandejaEvaluador() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [filas, setFilas] = useState<FilaEvaluacion[]>([])
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
        const evaluaciones = await evaluacionService.misEvaluaciones()
        // N+1 REPLICADO A PROPÓSITO (igual que la web evaluador/Bandeja.tsx):
        // mis-evaluaciones NO trae codigoUnico ni el expediente completo, así
        // que se hace un GET /expedientes/:id por fila para código/estado/fecha.
        const resueltas = await Promise.all(
          evaluaciones.map(async (evaluacion): Promise<FilaEvaluacion> => {
            try {
              const expediente = await expedientesService.getById(evaluacion.expedienteId)
              return { evaluacion, expediente }
            } catch {
              return { evaluacion, expediente: null }
            }
          }),
        )
        if (activo) setFilas(resueltas)
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las evaluaciones asignadas.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  // useFocusEffect (NO useEffect mount-only): al volver de la pantalla de
  // Evaluación (tras enviar/declarar conflicto), Tabs mantiene esta pantalla
  // montada; hay que recargar en cada focus para reflejar el badge nuevo
  // (lección de Fase 4/5).
  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar])
  )

  const filasFiltradas = useMemo(
    () => filtrarEvaluacionesAsignadas(filas, { busqueda, fechaDesde, fechaHasta }),
    [filas, busqueda, fechaDesde, fechaHasta],
  )

  function limpiarFiltros() {
    setBusqueda('')
    setFechaDesde('')
    setFechaHasta('')
  }

  function tituloDe(f: FilaEvaluacion) {
    return f.expediente?.tituloProtocolo ?? `Expediente #${f.evaluacion.expedienteId}`
  }
  function codigoDe(f: FilaEvaluacion) {
    return f.expediente?.codigoUnico ?? '—'
  }
  function nombreDe(f: FilaEvaluacion) {
    return f.expediente?.investigadorNombre ?? '—'
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={s.headerKicker}>Bandeja de evaluaciones</Text>
          <Text numberOfLines={1} style={s.headerTitle}>{usuario?.nombres} {usuario?.apellidos}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <PuntoEstado />
          <Pressable onPress={() => router.push('/(evaluador)/perfil')}>
            <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} size={40} />
          </Pressable>
        </View>
      </View>

      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}

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
            {cargando ? 'Cargando…' : `Evaluaciones asignadas (${filasFiltradas.length})`}
          </Text>
          <Pressable onPress={limpiarFiltros}><Text style={s.limpiar}>Limpiar</Text></Pressable>
        </View>

        <View style={{ gap: 10 }}>
          {cargando && <Loading label="Cargando evaluaciones…" />}
          {!cargando && !error && filasFiltradas.map(f => (
            <Pressable key={f.evaluacion.id} onPress={() => router.push(`/(evaluador)/evaluacion/${f.evaluacion.id}`)}>
              <Card>
                <Text numberOfLines={1} style={s.titulo}>{tituloDe(f)}</Text>
                <Text style={s.investigador}>{nombreDe(f)}</Text>
                <Text style={s.meta}>{codigoDe(f)} · {formatearFecha(f.expediente?.fechaEnvio ?? null)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {f.evaluacion.completa
                    ? <Badge label="Completada" bg={colors.successBg} fg={colors.success} />
                    : <Badge label="Pendiente" bg={colors.blue50} fg={colors.primary} />}
                  {f.evaluacion.conflictoInteres && <Badge label="⚠ Conflicto de interés" bg={colors.warnBg} fg={colors.warn} />}
                </View>
              </Card>
            </Pressable>
          ))}
          {!cargando && !error && filas.length === 0 && (
            <Text style={s.vacio}>No tienes evaluaciones asignadas por el momento.</Text>
          )}
          {!cargando && !error && filas.length > 0 && filasFiltradas.length === 0 && (
            <Text style={s.vacio}>Ninguna evaluación coincide con los filtros.</Text>
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
  titulo: { fontSize: 14, fontWeight: '700', color: colors.ink },
  investigador: { fontSize: 12.5, fontWeight: '500', color: colors.slate500, marginTop: 2, marginBottom: 2 },
  meta: { fontSize: 12, fontWeight: '500', color: colors.slate400 },
  vacio: { textAlign: 'center', fontSize: 13.5, color: colors.slate500, marginTop: 24 },
})
