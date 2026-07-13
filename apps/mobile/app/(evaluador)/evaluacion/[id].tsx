// app/(evaluador)/evaluacion/[id].tsx
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
import { useConfirm } from '../../../src/state/ConfirmContext'
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
  const confirmar = useConfirm()

  const [evaluacion, setEvaluacion] = useState<EvaluacionDetalleDto | null>(null)
  const [rubrica, setRubrica] = useState<RubricaDto | null>(null)
  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [criteriosEstado, setCriteriosEstado] = useState<Record<string, CriterioEstado>>({})
  const [observacionesGenerales, setObservacionesGenerales] = useState('')

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [declarando, setDeclarando] = useState(false)
  const [abriendo, setAbriendo] = useState<number | null>(null)
  const [descargando, setDescargando] = useState<'rubrica' | 'dictamen' | null>(null)

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

  function validarParaEnviar(): string | null {
    if (!rubrica) return 'La rúbrica aún no se ha cargado.'
    for (const c of rubrica.criterios) {
      const valor = criteriosEstado[c.key]?.puntaje ?? ''
      if (valor.trim() === '') return `Falta asignar el puntaje de "${c.nombre}".`
      const n = Number(valor)
      if (Number.isNaN(n) || n < 0 || n > c.puntajeMax) return `El puntaje de "${c.nombre}" debe estar entre 0 y ${c.puntajeMax}.`
    }
    return null
  }

  async function onGuardarAvance() {
    if (!evaluacion) return
    setGuardando(true); setError(''); setMensaje('')
    try {
      // guardar-parcial SOLO persiste observaciones (limitación real del
      // backend; los puntajes viven en estado local hasta Enviar). La
      // respuesta {message} NO pisa el estado local (el bug de la web que sí
      // lo pisa NO se replica aquí).
      const res = await evaluacionService.guardarAvance(evaluacion.id, observacionesGenerales)
      setMensaje(res.message || 'Avance guardado correctamente.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el avance.')
    } finally {
      setGuardando(false)
    }
  }

  async function onEnviar() {
    if (!evaluacion || !rubrica) return
    const problema = validarParaEnviar()
    if (problema) { setError(problema); setMensaje(''); return }
    if (!(await confirmar('Esta acción no se puede deshacer.', {
      titulo: 'Enviar evaluación de forma definitiva',
      textoConfirmar: 'Enviar evaluación',
    }))) return
    setEnviando(true); setError(''); setMensaje('')
    try {
      const actualizado = await evaluacionService.enviarEvaluacion(evaluacion.id, {
        observaciones: observacionesGenerales,
        completa: true,
        criterios: rubrica.criterios.map(c => ({
          key: c.key,
          puntaje: Number(criteriosEstado[c.key].puntaje),
          observacion: criteriosEstado[c.key].observacion.trim() || undefined,
        })),
      })
      // enviarEvaluacion SÍ devuelve el objeto completo (toResponse): se usa
      // para refrescar el estado y pasar a modo solo-lectura.
      setEvaluacion(actualizado)
      setMensaje('Evaluación enviada correctamente.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar la evaluación.')
    } finally {
      setEnviando(false)
    }
  }

  async function onDeclararConflicto() {
    if (!evaluacion) return
    if (!(await confirmar('Esta acción es irreversible y te retirará del proceso de evaluación.', {
      titulo: 'Declarar conflicto de interés',
      textoConfirmar: 'Declarar conflicto',
      peligroso: true,
    }))) return
    setDeclarando(true); setError(''); setMensaje('')
    try {
      // declararConflicto devuelve {message}; NO pisa el estado local (bug de
      // la web NO replicado). Se refleja el bloqueo marcando conflicto sobre
      // el estado ya cargado, sin sustituir el objeto por uno incompleto.
      const res = await evaluacionService.declararConflicto(evaluacion.id)
      setEvaluacion(prev => (prev ? { ...prev, conflictoInteres: true } : prev))
      setMensaje(res.message || 'Has declarado conflicto de interés. Ya no puedes continuar con esta evaluación.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo declarar el conflicto de interés.')
    } finally {
      setDeclarando(false)
    }
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

  async function onDescargarPdf(tipo: 'rubrica' | 'dictamen') {
    if (!evaluacion) return
    try {
      setDescargando(tipo); setError('')
      const url = tipo === 'rubrica'
        ? evaluacionService.urlDescargarRubrica(evaluacion.id)
        : evaluacionService.urlDescargarDictamen(evaluacion.id)
      await abrirDocumento(url, `${tipo}-evaluacion-${evaluacion.id}.pdf`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e instanceof Error ? e.message : `No se pudo descargar ${tipo === 'rubrica' ? 'la rúbrica' : 'el dictamen'}.`))
    } finally {
      setDescargando(null)
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
  // FIX (spec, decisión 3): el dictamen SOLO existe para aprobado /
  // aprobado_observaciones -> el botón de descarga solo se muestra en esos
  // casos (la web lo muestra erróneamente también en no_aprobado, porque
  // solo chequea `evaluacion.resultado` truthy).
  const hayDictamen = evaluacion.resultado === 'aprobado' || evaluacion.resultado === 'aprobado_observaciones'
  // FIX (mirror de la decisión anterior): la rúbrica en PDF SOLO se genera
  // en el backend para aprobado_observaciones / no_aprobado (ver
  // generarPdfsPostEnvio en evaluacion.service.ts) -> para 'aprobado' no
  // existe rubricaPdfPath y el botón llevaba a un 404 confuso.
  const hayRubrica = evaluacion.resultado === 'aprobado_observaciones' || evaluacion.resultado === 'no_aprobado'

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
        {!!mensaje && !error && <Text style={s.exito}>{mensaje}</Text>}

        {/* Acciones según el estado de la evaluación */}
        {soloLectura ? (
          <View style={{ gap: 10 }}>
            {hayRubrica && (
              <Button
                title={descargando === 'rubrica' ? 'Abriendo…' : 'Descargar rúbrica (PDF)'}
                variant="outline"
                loading={descargando === 'rubrica'}
                onPress={() => onDescargarPdf('rubrica')}
              />
            )}
            {hayDictamen && (
              <Button
                title={descargando === 'dictamen' ? 'Abriendo…' : 'Descargar dictamen (PDF)'}
                loading={descargando === 'dictamen'}
                onPress={() => onDescargarPdf('dictamen')}
              />
            )}
          </View>
        ) : conflicto ? (
          <Text style={s.muted}>Declaraste conflicto de interés en esta evaluación; ya no puedes editarla.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            <Button title={guardando ? 'Guardando…' : 'Guardar avance'} variant="outline" loading={guardando} onPress={onGuardarAvance} />
            <Button title={enviando ? 'Enviando…' : 'Enviar evaluación'} loading={enviando} onPress={onEnviar} />
            <Button title={declarando ? 'Declarando…' : 'Declarar conflicto de interés'} variant="danger" loading={declarando} onPress={onDeclararConflicto} />
          </View>
        )}
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
