// app/(evaluador)/evaluacion/[id].tsx  (parte 1 — acciones/bloqueo/PDF en Task 7)
import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle, TextArea } from '../../../src/components/ui'
import TopBar from '../../../src/components/TopBar'
import { colors } from '../../../src/lib/theme'
import { formatearFecha } from '../../../src/lib/dates'
import { ApiError, apiUrl } from '../../../src/lib/http'
import { abrirDocumento } from '../../../src/lib/documentDownload'
import { puntajeAcumulado, resultadoPrevisto, type ResultadoRubrica } from '../../../src/lib/rubricaResultado'
import { evaluacionService, expedientesService } from '../../../src/services'
import type { DocumentoDto, ExpedienteDto, RubricaDto } from '../../../src/types/api'
import type { EvaluacionDetalleDto } from '../../../src/services/evaluacion.service'

interface CriterioEstado {
  puntaje: string
  observacion: string
}

const RESULTADO_LABEL: Record<ResultadoRubrica, string> = {
  aprobado: 'Aprobado',
  aprobado_observaciones: 'Aprobado con observaciones',
  no_aprobado: 'No aprobado',
}
const RESULTADO_COLOR: Record<ResultadoRubrica, string> = {
  aprobado: colors.success,
  aprobado_observaciones: colors.warn,
  no_aprobado: colors.danger,
}

export default function Evaluacion() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const evaluacionId = Number(id)

  const [evaluacion, setEvaluacion] = useState<EvaluacionDetalleDto | null>(null)
  const [rubrica, setRubrica] = useState<RubricaDto | null>(null)
  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [criteriosEstado, setCriteriosEstado] = useState<Record<string, CriterioEstado>>({})
  const [observacionesGenerales, setObservacionesGenerales] = useState('')

  const [error, setError] = useState('')
  const [abriendo, setAbriendo] = useState<number | null>(null)

  useEffect(() => {
    if (!Number.isFinite(evaluacionId)) {
      setErrorCarga('El identificador de la evaluación no es válido.')
      setCargando(false)
      return
    }
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const [ev, rub] = await Promise.all([
          evaluacionService.getById(evaluacionId),
          evaluacionService.getRubrica(),
        ])
        if (cancelado) return
        setEvaluacion(ev)
        setRubrica(rub)
        setObservacionesGenerales(ev.observaciones ?? '')
        const inicial: Record<string, CriterioEstado> = {}
        for (const c of rub.criterios) {
          const existente = ev.criterios.find(cr => cr.criterioKey === c.key)
          inicial[c.key] = {
            puntaje: existente?.puntaje != null ? String(existente.puntaje) : '',
            observacion: existente?.observacion ?? '',
          }
        }
        setCriteriosEstado(inicial)
        // El detalle de la evaluación no trae el expediente completo (solo
        // campos aplanados) -- se busca aparte para el resumen y los documentos.
        // Si falla, no bloquea la evaluación en sí.
        try {
          const detalle = await expedientesService.getDetalle(ev.expedienteId)
          if (cancelado) return
          setExpediente(detalle.expediente)
          setDocumentos(detalle.documentos)
        } catch {
          // resumen/documentos opcionales
        }
      } catch (e) {
        if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la evaluación.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [evaluacionId])

  const total = useMemo(() => {
    if (!rubrica) return 0
    const puntajes: Record<string, string> = {}
    for (const c of rubrica.criterios) puntajes[c.key] = criteriosEstado[c.key]?.puntaje ?? ''
    return puntajeAcumulado(rubrica, puntajes)
  }, [rubrica, criteriosEstado])

  const resultado = useMemo<ResultadoRubrica | null>(
    () => (rubrica ? resultadoPrevisto(rubrica, total) : null),
    [rubrica, total],
  )

  const soloLectura = evaluacion?.completa === true
  const conflicto = evaluacion?.conflictoInteres === true
  const bloqueado = soloLectura || conflicto

  function actualizarCriterio(key: string, campo: keyof CriterioEstado, valor: string) {
    setCriteriosEstado(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }))
  }

  async function onAbrirDocumento(doc: DocumentoDto) {
    if (!expediente) return
    try {
      setAbriendo(doc.id)
      setError('')
      await abrirDocumento(apiUrl(`/expedientes/${expediente.id}/documentos/${doc.id}/descargar`), doc.nombreArchivo)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : 'No se pudo abrir el documento.'))
    } finally {
      setAbriendo(null)
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Evaluación" />
        <Loading label="Cargando evaluación…" />
      </View>
    )
  }

  if (errorCarga || !evaluacion || !rubrica) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Evaluación" />
        <View style={{ padding: 16 }}><ErrorText>{errorCarga || 'No se pudo cargar la evaluación.'}</ErrorText></View>
      </View>
    )
  }

  const pct = Math.min(100, Math.round((total / rubrica.puntajeTotalMax) * 100))

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Evaluación" />
      <Screen>
        {/* Resumen del expediente + investigador */}
        <Card>
          <Text style={s.cardTitle}>Resumen del expediente</Text>
          <Text style={s.line}><Text style={s.k}>Código: </Text>{expediente?.codigoUnico ?? `Expediente #${evaluacion.expedienteId}`}</Text>
          <Text style={s.line}><Text style={s.k}>Evaluación: </Text>#{evaluacion.id}</Text>
          <Text style={s.line}><Text style={s.k}>Título: </Text>{expediente?.tituloProtocolo ?? evaluacion.tituloProtocolo ?? 'Título no disponible'}</Text>
          {!!expediente?.facultad && <Text style={s.line}><Text style={s.k}>Facultad: </Text>{expediente.facultad}</Text>}
          {!!expediente?.tipoTramite && <Text style={s.line}><Text style={s.k}>Tipo: </Text>{expediente.tipoTramite}</Text>}
          <Text style={s.line}><Text style={s.k}>Investigador: </Text>{expediente?.investigadorNombre ?? evaluacion.investigadorNombre ?? 'No disponible'}</Text>
          <Text style={s.line}><Text style={s.k}>Fecha de envío: </Text>{formatearFecha(expediente?.fechaEnvio ?? evaluacion.expedienteFechaEnvio ?? null)}</Text>
        </Card>

        {/* Documentos para revisión */}
        <SectionTitle>Documentos para revisión</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {documentos.map(d => (
            <View key={d.id} style={s.docRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.docNombre}>{d.nombreArchivo}</Text>
                <Text style={s.docTipo}>{d.tipoDocumento}</Text>
              </View>
              <Button
                title={abriendo === d.id ? 'Abriendo…' : 'Abrir'}
                variant="outline"
                loading={abriendo === d.id}
                onPress={() => onAbrirDocumento(d)}
                style={{ paddingHorizontal: 16, paddingVertical: 9 }}
              />
            </View>
          ))}
          {documentos.length === 0 && <Text style={s.vacioRow}>No hay documentos disponibles para este expediente en este momento.</Text>}
        </Card>

        {/* Progreso / resultado previsto (en vivo) */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Text style={s.progLabel}>Puntaje acumulado</Text>
            <Text style={s.progValor}>{total} / {rubrica.puntajeTotalMax}</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: resultado ? RESULTADO_COLOR[resultado] : colors.primary }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Text style={s.progHint}>Resultado previsto</Text>
            <Text style={[s.progResultado, { color: resultado ? RESULTADO_COLOR[resultado] : colors.slate500 }]}>{resultado ? RESULTADO_LABEL[resultado] : '—'}</Text>
          </View>
        </Card>

        {/* Criterios (Selector-píldora por puntaje) */}
        <SectionTitle>Criterios de evaluación</SectionTitle>
        <View style={{ gap: 12 }}>
          {rubrica.criterios.map(c => {
            const opciones = Array.from({ length: c.puntajeMax + 1 }, (_, n) => n)
            const puntajeSel = criteriosEstado[c.key]?.puntaje ?? ''
            return (
              <Card key={c.key} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={s.critNombre}>{c.nombre}</Text>
                  <Text style={s.critMax}>máx. {c.puntajeMax} pts</Text>
                </View>
                <Text style={s.critDesc}>{c.descripcion}</Text>
                <Field label="Puntaje">
                  <View style={s.segment}>
                    {opciones.map(n => {
                      const sel = puntajeSel === String(n)
                      return (
                        <Pressable
                          key={n}
                          disabled={bloqueado}
                          onPress={() => actualizarCriterio(c.key, 'puntaje', String(n))}
                          style={[s.segItem, sel && s.segItemActive, bloqueado && s.segItemDisabled]}
                        >
                          <Text style={[s.segText, sel && s.segTextActive]}>{n}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </Field>
                <Field label="Observación (opcional)">
                  <TextArea
                    editable={!bloqueado}
                    placeholder="Comentario sobre este criterio…"
                    value={criteriosEstado[c.key]?.observacion ?? ''}
                    onChangeText={v => actualizarCriterio(c.key, 'observacion', v)}
                    style={{ minHeight: 60 }}
                  />
                </Field>
              </Card>
            )
          })}
        </View>

        <Field label="Observaciones generales">
          <TextArea
            editable={!bloqueado}
            placeholder="Comentarios generales sobre el protocolo…"
            value={observacionesGenerales}
            onChangeText={setObservacionesGenerales}
          />
        </Field>

        {!!error && <ErrorText>{error}</ErrorText>}
        {/* Acciones (Guardar/Enviar/Conflicto), estados de bloqueo y botones de PDF: Task 7. */}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  cardTitle: { fontSize: 12, fontWeight: '700', color: colors.navy, marginBottom: 8 },
  line: { fontSize: 12.5, color: colors.slate700, lineHeight: 19 },
  k: { fontWeight: '700', color: colors.ink },
  docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  docNombre: { fontSize: 13, fontWeight: '600', color: colors.ink },
  docTipo: { fontSize: 11.5, color: colors.slate400, marginTop: 2 },
  vacioRow: { fontSize: 12.5, color: colors.slate500, padding: 14 },
  progLabel: { fontSize: 12.5, fontWeight: '600', color: colors.slate700 },
  progValor: { fontSize: 15, fontWeight: '700', color: colors.ink },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.lineSoft, overflow: 'hidden' },
  barFill: { height: '100%' },
  progHint: { fontSize: 12, color: colors.slate500 },
  progResultado: { fontSize: 13, fontWeight: '700' },
  critNombre: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.ink },
  critMax: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  critDesc: { fontSize: 12, color: colors.slate500, lineHeight: 17 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { minWidth: 40, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segItemDisabled: { opacity: 0.5 },
  segText: { fontSize: 13, color: colors.slate500, fontWeight: '700' },
  segTextActive: { color: '#fff' },
  exito: { color: colors.success, fontSize: 13, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.slate500, lineHeight: 18 },
})
