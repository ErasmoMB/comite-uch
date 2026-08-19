// app/(app)/proyectos/[id].tsx
import { useCallback, useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Badge, Button, Card, ErrorText, Loading, Screen, StatusBadge } from '../../../src/components/ui'
import TopBar from '../../../src/components/TopBar'
import { colors } from '../../../src/lib/theme'
import { formatearFechaHora } from '../../../src/lib/dates'
import { ApiError } from '../../../src/lib/http'
import { abrirDocumento, hayDictamen, hayRubrica, RESULTADO_LABEL } from '../../../src/lib/documentDownload'
import { ESTADO_LABEL, toDomainProyecto } from '../../../src/lib/mappers'
import { evaluacionService, expedientesService } from '../../../src/services'
import type { DocumentoDto, EstadoExpediente, ExpedienteDto, HistorialDto, RequisitosDto } from '../../../src/types/api'

const ESTADOS_CAMBIO_TITULO: EstadoExpediente[] = ['aprobado', 'aprobado_observaciones']

export default function DetalleProyecto() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const expedienteId = Number(id)

  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoDto[]>([])
  const [historial, setHistorial] = useState<HistorialDto[]>([])
  const [requisitos, setRequisitos] = useState<RequisitosDto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [accionError, setAccionError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [descargando, setDescargando] = useState<'rubrica' | 'dictamen' | null>(null)
  const [descargaError, setDescargaError] = useState('')

  async function onDescargarEvaluacion(tipo: 'rubrica' | 'dictamen', evaluacionId: number) {
    try {
      setDescargando(tipo)
      setDescargaError('')
      const url =
        tipo === 'rubrica'
          ? evaluacionService.urlDescargarRubrica(evaluacionId)
          : evaluacionService.urlDescargarDictamen(evaluacionId)
      await abrirDocumento(url, `${tipo}-${expediente?.codigoUnico ?? evaluacionId}.pdf`)
    } catch (e) {
      setDescargaError(
        e instanceof ApiError || e instanceof Error
          ? e.message
          : `No se pudo descargar ${tipo === 'rubrica' ? 'la rúbrica' : 'el dictamen'}.`,
      )
    } finally {
      setDescargando(null)
    }
  }

  const cargar = useCallback(async () => {
    if (!Number.isFinite(expedienteId)) {
      setNoEncontrado(true)
      setCargando(false)
      return
    }
    setCargando(true)
    try {
      const [detalle, req] = await Promise.all([
        expedientesService.getDetalle(expedienteId),
        expedientesService.getRequisitos(expedienteId).catch(() => null),
      ])
      setExpediente(detalle.expediente)
      setDocumentos(detalle.documentos)
      setHistorial(detalle.historial)
      setRequisitos(req)
    } catch {
      setNoEncontrado(true)
    } finally {
      setCargando(false)
    }
  }, [expedienteId])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (noEncontrado) router.replace('/(app)/proyectos')
  }, [noEncontrado, router])

  if (noEncontrado) return null

  if (cargando || !expediente) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Detalle del proyecto" />
        <Loading label="Cargando proyecto…" />
      </View>
    )
  }

  const proyecto = toDomainProyecto(expediente, documentos)

  async function handleEnviar() {
    setEnviando(true)
    setAccionError('')
    try {
      await expedientesService.enviar(expediente!.id)
      await cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo enviar el proyecto.')
    } finally {
      setEnviando(false)
    }
  }

  const esBorrador = expediente.estado === 'borrador'
  const puedeCambiarTitulo = ESTADOS_CAMBIO_TITULO.includes(expediente.estado)

  // Filas del checklist: si hay requisitos reales, se arma a partir de los
  // tipos de documento requeridos por la modalidad; si no, se listan
  // simplemente los documentos ya cargados.
  const filasChecklist = requisitos
    ? requisitos.documentosRequeridos.map(req => ({
        tipo: req.tipo,
        nombre: req.label,
        doc: documentos.find(d => d.tipoDocumento === req.tipo) ?? null,
      }))
    : documentos.map(d => ({ tipo: d.tipoDocumento, nombre: d.nombreArchivo, doc: d }))

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Detalle del proyecto" />
      <Screen>
        <Card style={{ padding: 13 }}>
          <View style={s.cabeceraTop}>
            <Text style={s.codigo}>{proyecto.codigo ?? '—'}</Text>
            <StatusBadge estado={proyecto.estado} />
          </View>
          <Text style={s.titulo}>{proyecto.titulo}</Text>
        </Card>

        {!!expediente.evaluacionResultado && !!expediente.evaluacionId && (
          <>
            <Text style={s.seccionTitulo}>Resultado del comité</Text>
            <Card style={{ padding: 13, gap: 10 }}>
              <View style={{ gap: 3 }}>
                <Text style={s.muted}>Resultado de la evaluación</Text>
                <Text style={[s.resultado, { color: colorResultado(expediente.evaluacionResultado) }]}>
                  {RESULTADO_LABEL[expediente.evaluacionResultado] ?? expediente.evaluacionResultado}
                </Text>
              </View>
              {!!descargaError && <ErrorText>{descargaError}</ErrorText>}
              {hayDictamen(expediente.evaluacionResultado) && (
                <Button
                  title={descargando === 'dictamen' ? 'Abriendo…' : 'Descargar dictamen (PDF)'}
                  loading={descargando === 'dictamen'}
                  onPress={() => onDescargarEvaluacion('dictamen', expediente.evaluacionId!)}
                />
              )}
              {hayRubrica(expediente.evaluacionResultado) && (
                <Button
                  title={descargando === 'rubrica' ? 'Abriendo…' : 'Descargar rúbrica (PDF)'}
                  variant="outline"
                  loading={descargando === 'rubrica'}
                  onPress={() => onDescargarEvaluacion('rubrica', expediente.evaluacionId!)}
                />
              )}
            </Card>
          </>
        )}

        <Text style={s.seccionTitulo}>Checklist documental</Text>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filasChecklist.map(f => (
            <ChecklistRow key={f.tipo} nombre={f.nombre} doc={f.doc} esBorrador={esBorrador} />
          ))}
          {filasChecklist.length === 0 && (
            <Text style={s.checklistVacio}>Aún no se han cargado documentos.</Text>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          {!!accionError && <ErrorText>{accionError}</ErrorText>}
          {esBorrador && requisitos && !requisitos.completo && (
            <Text style={s.muted}>Falta: {requisitos.faltantes.join(', ')}</Text>
          )}
          {esBorrador && (
            <Button title={enviando ? 'Enviando…' : 'Enviar proyecto'} onPress={handleEnviar} loading={enviando} />
          )}
          {/* Sin esta salida, un borrador con datos incompletos (p. ej. un
              integrante sin teléfono) quedaba trabado: el envío lo rechazaba
              y no había ninguna pantalla para completarlo. */}
          {esBorrador && (
            <Button
              title="Editar datos del proyecto ›"
              variant="outline"
              onPress={() => router.push(`/(app)/nuevo?id=${expediente!.id}`)}
            />
          )}
          {puedeCambiarTitulo && (
            <Button
              title="Solicitar cambio de título ›"
              variant="outline"
              onPress={() => router.push(`/(app)/cambiar-titulo?id=${expediente!.id}`)}
            />
          )}
        </View>

        <Text style={s.seccionTitulo}>Historial</Text>
        <Card style={{ padding: 13, gap: 4 }}>
          <HistorialPanel historial={historial} />
        </Card>
      </Screen>
    </View>
  )
}

function colorResultado(resultado: string): string {
  if (resultado === 'aprobado') return colors.success
  if (resultado === 'no_aprobado') return colors.danger
  return colors.warn
}

function ChecklistRow({ nombre, doc, esBorrador }: { nombre: string; doc: DocumentoDto | null; esBorrador: boolean }) {
  const cargado = !!doc
  return (
    <View style={s.checklistRow}>
      <View style={s.checklistLeft}>
        <View style={[s.dot, cargado ? s.dotOn : s.dotOff]}>
          <Text style={[s.dotText, cargado && { color: '#fff' }]}>{cargado ? '✓' : '–'}</Text>
        </View>
        <Text numberOfLines={1} style={s.checklistNombre}>{nombre}</Text>
      </View>
      <View style={s.checklistRight}>
        {cargado ? (
          <Badge label="Cargado" bg={colors.successBg} fg={colors.success} />
        ) : esBorrador ? (
          // TODO Fase posterior: expo-document-picker — subir documento real desde el dispositivo.
          <Text style={s.subirDisabled}>Subir</Text>
        ) : (
          <Text style={s.muted}>Pendiente</Text>
        )}
      </View>
    </View>
  )
}

function HistorialPanel({ historial }: { historial: HistorialDto[] }) {
  if (historial.length === 0) return <Text style={s.muted}>Sin movimientos registrados.</Text>
  return (
    <>
      {historial.map(h => (
        <Text key={h.id} style={s.historialItem}>
          {formatearFechaHora(h.createdAt)} — {ESTADO_LABEL[h.estadoNuevo as keyof typeof ESTADO_LABEL] ?? h.estadoNuevo}
          {h.observaciones ? `: ${h.observaciones}` : ''}
        </Text>
      ))}
    </>
  )
}

const s = StyleSheet.create({
  cabeceraTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 },
  codigo: { fontSize: 13, fontWeight: '600', color: colors.slate400 },
  titulo: { fontSize: 15, fontWeight: '700', lineHeight: 21, color: colors.ink },
  seccionTitulo: { fontSize: 13, fontWeight: '700', color: colors.navy },
  resultado: { fontSize: 15, fontWeight: '700' },
  checklistVacio: { fontSize: 13, color: colors.slate500, padding: 14 },
  checklistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  checklistLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  checklistRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  checklistNombre: { fontSize: 13.5, fontWeight: '500', color: colors.ink, flexShrink: 1 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.success },
  dotOff: { backgroundColor: colors.chipBg },
  dotText: { fontSize: 10, fontWeight: '700', color: colors.slate400 },
  subirDisabled: { fontSize: 13, fontWeight: '600', color: colors.slate400 },
  muted: { fontSize: 13, color: colors.slate500 },
  historialItem: { fontSize: 11.5, lineHeight: 18, color: colors.slate500 },
})
