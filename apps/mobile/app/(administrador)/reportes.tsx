// app/(administrador)/reportes.tsx
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, ErrorText, Loading, Screen } from '../../src/components/ui'
import HBarChart, { type HBarDatum } from '../../src/components/charts/HBarChart'
import StackedHBarChart, { type StackedDatum } from '../../src/components/charts/StackedHBarChart'
import { colors } from '../../src/lib/theme'
import { ESTADO_LABEL } from '../../src/lib/mappers'
import { ApiError } from '../../src/lib/http'
import { abrirDocumento } from '../../src/lib/documentDownload'
import { reportesService } from '../../src/services'
import type { ResumenReporte } from '../../src/services/reportes.service'

function estadoLabel(estado: string) {
  return ESTADO_LABEL[estado as keyof typeof ESTADO_LABEL] ?? estado
}

// Colores hex reales (RN no soporta var(--...) del CSS web). Alineados con
// theme/badgeColors para que el gráfico hable el mismo idioma visual que las
// badges de estado del resto de la app.
const ESTADO_COLOR: Record<string, string> = {
  borrador: colors.slate400,
  enviado: colors.primary,
  en_revision: colors.primary,
  subsanacion: colors.warn,
  aprobado: colors.success,
  aprobado_observaciones: colors.warn,
  no_aprobado: colors.danger,
  archivado: colors.slate400,
}

export default function ReportesAdmin() {
  const insets = useSafeAreaInsets()
  const [resumen, setResumen] = useState<ResumenReporte | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorExport, setErrorExport] = useState('')
  const [exportando, setExportando] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    reportesService
      .resumen()
      .then(r => { if (!cancelado) setResumen(r) })
      .catch(e => { if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudo cargar el reporte.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  const exportar = useCallback(async (clave: string, url: string, nombre: string) => {
    setErrorExport('')
    setExportando(clave)
    try {
      // Reutiliza documentDownload.ts (Fase 4): descarga autenticada + share
      // sheet nativo -- mismo camino que los PDFs de rúbrica/dictamen.
      await abrirDocumento(url, nombre)
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'No se pudo exportar.')
    } finally {
      setExportando(null)
    }
  }, [])

  const metricas = resumen
    ? [
        { n: resumen.expedientes.total, label: 'Expedientes totales', color: colors.primary },
        { n: resumen.evaluadores.totalEvaluadores, label: 'Evaluadores', color: colors.navy },
        { n: Math.round(resumen.evaluadores.cargaPromedio * 10) / 10, label: 'Carga promedio', color: colors.warn },
        { n: resumen.evaluadores.cargaMaxima, label: 'Carga máxima', color: colors.success },
      ]
    : []

  const datosPorEstado: HBarDatum[] = resumen
    ? Object.entries(resumen.expedientes.porEstado)
        .filter(([, total]) => total > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([estado, total]) => ({ key: estado, label: estadoLabel(estado), value: total, color: ESTADO_COLOR[estado] ?? colors.slate400 }))
    : []

  const datosCarga: HBarDatum[] = resumen
    ? [...resumen.cargaEvaluadores]
        .sort((a, b) => b.totalEvaluaciones - a.totalEvaluaciones)
        .map(c => ({ key: String(c.evaluadorId), label: c.nombre ?? `Evaluador #${c.evaluadorId}`, value: c.totalEvaluaciones, color: colors.primary }))
    : []

  const datosResultados: StackedDatum[] = resumen
    ? resumen.resultados.map(r => ({ key: r.tipo, label: estadoLabel(r.tipo), value: r.total, color: ESTADO_COLOR[r.tipo] ?? colors.slate400 }))
    : []

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerKicker}>Administración</Text>
        <Text style={s.headerTitle}>Reportes</Text>
      </View>

      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}
        {cargando && <Loading label="Cargando reporte…" />}

        {resumen && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
              {metricas.map(m => (
                <Card key={m.label} style={[s.cardSombra, { flexBasis: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 12 }]}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: m.color }}>{m.n}</Text>
                  <Text style={{ fontSize: 11.5, color: colors.slate500, textAlign: 'center' }}>{m.label}</Text>
                </Card>
              ))}
            </View>

            <Card style={[s.cardSombra, { gap: 12 }]}>
              <Text style={s.tituloGrafico}>Expedientes por estado</Text>
              <HBarChart data={datosPorEstado} />
            </Card>

            <Card style={[s.cardSombra, { gap: 12 }]}>
              <Text style={s.tituloGrafico}>Carga por evaluador</Text>
              <HBarChart data={datosCarga} />
            </Card>

            <Card style={[s.cardSombra, { gap: 12 }]}>
              <Text style={s.tituloGrafico}>Resultados emitidos</Text>
              <StackedHBarChart data={datosResultados} />
            </Card>

            <Card style={[s.cardSombra, { gap: 10 }]}>
              <Text style={s.tituloGrafico}>Exportar</Text>
              <Button
                title={exportando === 'expedientes' ? 'Descargando…' : 'Expedientes (PDF)'}
                variant="outline"
                loading={exportando === 'expedientes'}
                onPress={() => exportar('expedientes', reportesService.urlExportar('expedientes'), 'expedientes.pdf')}
              />
              <Button
                title={exportando === 'evaluaciones' ? 'Descargando…' : 'Evaluaciones (PDF)'}
                variant="outline"
                loading={exportando === 'evaluaciones'}
                onPress={() => exportar('evaluaciones', reportesService.urlExportar('evaluaciones'), 'evaluaciones.pdf')}
              />
              <Button
                title={exportando === 'reporte' ? 'Descargando…' : 'Reporte con gráficos (PDF)'}
                variant="outline"
                loading={exportando === 'reporte'}
                onPress={() => exportar('reporte', reportesService.urlExportarReporte(), 'reporte-gestion.pdf')}
              />
              {!!errorExport && <ErrorText>{errorExport}</ErrorText>}
            </Card>
          </>
        )}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerKicker: { fontSize: 12.5, color: colors.slate500 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  tituloGrafico: { fontSize: 13, fontWeight: '700', color: colors.navy },
  cardSombra: {
    shadowColor: colors.navy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
})
