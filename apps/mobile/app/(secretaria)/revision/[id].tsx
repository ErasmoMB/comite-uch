// app/(secretaria)/revision/[id].tsx
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Button, Card, ErrorText, Field, Loading, Screen, SectionTitle, StatusBadge, TextArea } from '../../../src/components/ui'
import TopBar from '../../../src/components/TopBar'
import { colors } from '../../../src/lib/theme'
import { formatearFechaHora } from '../../../src/lib/dates'
import { ApiError, apiUrl } from '../../../src/lib/http'
import { abrirDocumento } from '../../../src/lib/documentDownload'
import { expedientesService } from '../../../src/services'
import { useConfirm } from '../../../src/state/ConfirmContext'
import type { BitacoraDto, DocumentoDto, ExpedienteDto, HistorialDto } from '../../../src/types/api'

interface Detalle {
  expediente: ExpedienteDto
  bitacora: BitacoraDto[]
  historial: HistorialDto[]
  documentos: DocumentoDto[]
}

export default function Revision() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const expedienteId = Number(id)
  const router = useRouter()
  const confirmar = useConfirm()

  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [accionEnCurso, setAccionEnCurso] = useState<'admitir' | 'devolver' | null>(null)
  const [abriendo, setAbriendo] = useState<number | null>(null)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      try {
        setCargando(true)
        const data = await expedientesService.getDetalle(expedienteId)
        if (cancelado) return
        setDetalle(data)
        setError('')
      } catch (err) {
        if (cancelado) return
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el expediente.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (!Number.isNaN(expedienteId)) cargar()
    return () => { cancelado = true }
  }, [expedienteId])

  async function handleAbrir(doc: DocumentoDto) {
    try {
      setAbriendo(doc.id)
      setError('')
      await abrirDocumento(apiUrl(`/expedientes/${expedienteId}/documentos/${doc.id}/descargar`), doc.nombreArchivo)
    } catch (err) {
      // abrirDocumento lanza Error (no ApiError) en fallos de descarga/compartir;
      // se muestra su mensaje real en vez de un genérico de ApiError.
      setError(err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'No se pudo abrir el documento.'))
    } finally {
      setAbriendo(null)
    }
  }

  async function handleAdmitir() {
    if (!(await confirmar('¿Admitir este expediente y pasarlo a revisión de fondo?', { titulo: 'Admitir expediente', textoConfirmar: 'Admitir' }))) return
    try {
      setAccionEnCurso('admitir')
      await expedientesService.update(expedienteId, { estado: 'en_revision' })
      router.replace('/(secretaria)')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo admitir el expediente.')
    } finally {
      setAccionEnCurso(null)
    }
  }

  async function handleDevolver() {
    if (!observaciones.trim()) {
      setError('Describe las observaciones para el investigador antes de devolver el expediente.')
      return
    }
    if (!(await confirmar('¿Devolver este expediente al investigador para subsanación?', { titulo: 'Devolver para subsanación', textoConfirmar: 'Devolver' }))) return
    try {
      setAccionEnCurso('devolver')
      // NOTA: el backend actual (PUT /expedientes/:id) no persiste el texto de
      // observaciones (limitación conocida, igual que en la web). Se pide y
      // valida el texto porque el flujo lo requiere, sin inventar persistencia.
      await expedientesService.update(expedienteId, { estado: 'subsanacion' })
      router.replace('/(secretaria)')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo devolver el expediente para subsanación.')
    } finally {
      setAccionEnCurso(null)
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Revisión de expediente" />
        <Loading label="Cargando expediente…" />
      </View>
    )
  }

  if (!detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Revisión de expediente" />
        <View style={{ padding: 16 }}><ErrorText>{error || 'Expediente no encontrado.'}</ErrorText></View>
      </View>
    )
  }

  const { expediente, bitacora, historial, documentos } = detalle
  const cargandoAccion = accionEnCurso !== null

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Revisión de expediente" />
      <Screen>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={s.codigo}>{expediente.codigoUnico ?? '—'}</Text>
            <StatusBadge estado={expediente.estado} />
          </View>
          <Text style={s.titulo}>{expediente.tituloProtocolo}</Text>
        </Card>

        {!!error && <ErrorText>{error}</ErrorText>}

        <SectionTitle>Autores</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {(expediente.autores ?? []).map((a, i) => (
            <View key={a.id ?? i} style={s.row}>
              <Text style={s.rowMain}>{a.apellidosNombres}</Text>
              <Text style={s.rowSub}>{a.esPrincipal ? 'Autor principal' : 'Coautor'} · {a.correo ?? '—'}</Text>
            </View>
          ))}
          {(expediente.autores ?? []).length === 0 && (
            <Text style={s.vacioRow}>Sin autores registrados.</Text>
          )}
        </Card>

        <SectionTitle>Documentos</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {documentos.map(d => (
            <View key={d.id} style={[s.row, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.rowMain}>{d.nombreArchivo}</Text>
                <Text style={s.rowSub}>{d.tipoDocumento}</Text>
              </View>
              <Button
                title={abriendo === d.id ? 'Abriendo…' : 'Abrir'}
                variant="outline"
                loading={abriendo === d.id}
                onPress={() => handleAbrir(d)}
                style={{ paddingHorizontal: 16, paddingVertical: 9 }}
              />
            </View>
          ))}
          {documentos.length === 0 && (
            <Text style={s.vacioRow}>Este expediente no tiene documentos cargados.</Text>
          )}
        </Card>

        <SectionTitle>Bitácora / historial</SectionTitle>
        <Card>
          {historial.map(h => (
            <View key={`h-${h.id}`} style={{ marginBottom: 8 }}>
              <Text style={s.feedFecha}>{formatearFechaHora(h.createdAt)} — {(h.estadoAnterior ?? '—')} → {h.estadoNuevo}</Text>
              {!!h.observaciones && <Text style={s.feedDetalle}>{h.observaciones}</Text>}
            </View>
          ))}
          {bitacora.map(b => (
            <View key={`b-${b.id}`} style={{ marginBottom: 8 }}>
              <Text style={s.feedFecha}>{formatearFechaHora(b.createdAt)} — {b.accion}</Text>
              {!!b.detalle && <Text style={s.feedDetalle}>{b.detalle}</Text>}
            </View>
          ))}
          {historial.length === 0 && bitacora.length === 0 && (
            <Text style={s.vacioRow}>Sin movimientos registrados.</Text>
          )}
        </Card>

        <Field label="Observaciones para subsanación">
          <TextArea
            placeholder="Describe qué debe corregir o completar el investigador…"
            value={observaciones}
            onChangeText={setObservaciones}
          />
        </Field>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={accionEnCurso === 'devolver' ? 'Enviando…' : 'Devolver'} variant="outline" style={{ flex: 1 }} disabled={cargandoAccion} loading={accionEnCurso === 'devolver'} onPress={handleDevolver} />
          <Button title={accionEnCurso === 'admitir' ? 'Admitiendo…' : 'Admitir'} style={{ flex: 1 }} disabled={cargandoAccion} loading={accionEnCurso === 'admitir'} onPress={handleAdmitir} />
        </View>
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  codigo: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  titulo: { fontSize: 15, fontWeight: '700', color: colors.ink, lineHeight: 20 },
  row: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  rowMain: { fontSize: 13.5, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: 11.5, color: colors.slate400, marginTop: 2 },
  vacioRow: { fontSize: 12.5, color: colors.slate500, padding: 14 },
  feedFecha: { fontSize: 12, fontWeight: '600', color: colors.ink, lineHeight: 18 },
  feedDetalle: { fontSize: 12, color: colors.slate500, lineHeight: 18 },
})
