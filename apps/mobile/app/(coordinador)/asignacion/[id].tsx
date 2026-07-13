// app/(coordinador)/asignacion/[id].tsx
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Badge, Button, Card, ErrorText, Loading, Screen, SectionTitle, StatusBadge } from '../../../src/components/ui'
import TopBar from '../../../src/components/TopBar'
import { colors } from '../../../src/lib/theme'
import { ApiError } from '../../../src/lib/http'
import { ordenarPorCarga, pendientesPorEvaluador } from '../../../src/lib/evaluadorCarga'
import { evaluacionService, expedientesService, usersService } from '../../../src/services'
import { useConfirm } from '../../../src/state/ConfirmContext'
import type { EvaluacionDto, ExpedienteDto, UserDto } from '../../../src/types/api'

export default function Asignacion() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const expedienteId = Number(id)
  const router = useRouter()
  const confirmar = useConfirm()

  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [evaluadores, setEvaluadores] = useState<UserDto[]>([])
  const [evaluacionExistente, setEvaluacionExistente] = useState<EvaluacionDto | null>(null)
  const [pendientes, setPendientes] = useState<Record<number, number>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [asignando, setAsignando] = useState(false)
  const [asignError, setAsignError] = useState('')

  useEffect(() => {
    if (!Number.isFinite(expedienteId)) {
      setError('El identificador del expediente no es válido.')
      setCargando(false)
      return
    }
    let vivo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const [exp, disponibles, evaluaciones] = await Promise.all([
          expedientesService.getById(expedienteId),
          usersService.evaluadoresDisponibles(),
          evaluacionService.list(0, 500),
        ])
        if (!vivo) return
        setExpediente(exp)
        setEvaluadores(disponibles)
        setEvaluacionExistente(evaluaciones.find(e => e.expedienteId === expedienteId) ?? null)
        setPendientes(pendientesPorEvaluador(evaluaciones))
      } catch (err) {
        if (vivo) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la información del expediente.')
      } finally {
        if (vivo) setCargando(false)
      }
    }
    cargar()
    return () => { vivo = false }
  }, [expedienteId])

  const evaluadoresOrdenados = ordenarPorCarga(evaluadores, pendientes)

  function nombreEvaluadorAsignado(): string {
    if (!evaluacionExistente) return ''
    const u = evaluadores.find(e => e.id === evaluacionExistente.evaluadorId)
    return u ? `${u.nombre} ${u.apellido}` : `Evaluador #${evaluacionExistente.evaluadorId}`
  }

  async function asignar() {
    if (!seleccionado) return
    if (!(await confirmar('¿Asignar este evaluador al expediente? Solo se permite un evaluador por expediente.', { titulo: 'Asignar evaluador', textoConfirmar: 'Asignar' }))) return
    setAsignando(true)
    setAsignError('')
    try {
      await evaluacionService.asignarEvaluador(expedienteId, seleccionado)
      router.replace('/(coordinador)')
    } catch (err) {
      // El backend responde 400 si el expediente ya tiene evaluador (carrera con
      // otro coordinador); se muestra ese mensaje sin crashear.
      setAsignError(err instanceof ApiError ? err.message : 'No se pudo asignar el evaluador. Intenta nuevamente.')
    } finally {
      setAsignando(false)
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Asignar evaluador" />
        <Loading label="Cargando expediente…" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Asignar evaluador" />
      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}

        {!error && expediente && (
          <>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={s.codigo}>{expediente.codigoUnico ?? '—'}</Text>
                <StatusBadge estado={expediente.estado} />
              </View>
              <Text style={s.titulo}>{expediente.tituloProtocolo}</Text>
            </Card>

            {evaluacionExistente ? (
              <>
                <View style={s.asignadoCard}>
                  <Text style={s.asignadoTitulo}>Ya asignado</Text>
                  <Text style={s.asignadoNombre}>{nombreEvaluadorAsignado()}</Text>
                  <Text style={s.asignadoNota}>
                    Este expediente ya tiene un evaluador asignado. Solo se permite uno por expediente.
                  </Text>
                </View>
                <Button title="Volver al panel" variant="outline" onPress={() => router.replace('/(coordinador)')} />
              </>
            ) : (
              <>
                <SectionTitle>Selecciona un evaluador</SectionTitle>
                <View style={{ gap: 8 }}>
                  {evaluadoresOrdenados.map(ev => {
                    const n = pendientes[ev.id] ?? 0
                    const sel = seleccionado === ev.id
                    return (
                      <Pressable
                        key={ev.id}
                        onPress={() => setSeleccionado(ev.id)}
                        style={[s.evalRow, sel && s.evalRowActive]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={[s.evalNombre, sel && s.evalNombreActive]}>
                            {ev.nombre} {ev.apellido}
                          </Text>
                          <Text numberOfLines={1} style={s.evalEsp}>{ev.especialidad ?? 'Sin especialidad'}</Text>
                        </View>
                        <Badge
                          label={`${n} pendiente${n === 1 ? '' : 's'}`}
                          bg={n === 0 ? colors.successBg : colors.chipBg}
                          fg={n === 0 ? colors.success : colors.slate500}
                        />
                      </Pressable>
                    )
                  })}
                  {evaluadores.length === 0 && (
                    <Text style={s.vacio}>No hay evaluadores disponibles en este momento.</Text>
                  )}
                </View>

                {!!asignError && <ErrorText>{asignError}</ErrorText>}

                {evaluadores.length > 0 && (
                  <Button
                    title={asignando ? 'Asignando…' : 'Asignar'}
                    disabled={!seleccionado || asignando}
                    loading={asignando}
                    onPress={asignar}
                  />
                )}
              </>
            )}
          </>
        )}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  codigo: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  titulo: { fontSize: 15, fontWeight: '700', color: colors.ink, lineHeight: 20 },
  asignadoCard: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: 12, padding: 14 },
  asignadoTitulo: { fontSize: 13, fontWeight: '700', color: colors.success, marginBottom: 4 },
  asignadoNombre: { fontSize: 14, fontWeight: '600', color: colors.ink },
  asignadoNota: { fontSize: 12, color: colors.slate500, marginTop: 6, lineHeight: 17 },
  evalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fff' },
  evalRowActive: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.blue50 },
  evalNombre: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  evalNombreActive: { color: colors.primary },
  evalEsp: { fontSize: 11.5, fontWeight: '500', color: colors.slate400, marginTop: 2 },
  vacio: { fontSize: 13, color: colors.slate500, paddingVertical: 6 },
})
