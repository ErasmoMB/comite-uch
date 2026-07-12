import { useEffect, useState } from 'react'
import BottomNav from '../components/BottomNav'
import HBarChart, { type HBarDatum } from '../components/charts/HBarChart'
import StackedHBarChart, { type StackedDatum } from '../components/charts/StackedHBarChart'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { ESTADO_LABEL } from '../lib/mappers'
import { ApiError } from '../lib/http'
import { reportesService } from '../services'
import type { ResumenReporte } from '../services/reportes.service'

function estadoLabel(estado: string) {
  return ESTADO_LABEL[estado as keyof typeof ESTADO_LABEL] ?? estado
}

// Mismo color que ya usan los badges de estado en el resto de la app
// (.badge-aprobado, .badge-en_revision, etc.) -- así el gráfico y las
// etiquetas que el usuario ve en las tablas hablan el mismo idioma visual.
const ESTADO_COLOR: Record<string, string> = {
  borrador: 'var(--slate-400)',
  enviado: 'var(--primary)',
  en_revision: 'var(--purple)',
  subsanacion: 'var(--warn)',
  aprobado: 'var(--success)',
  aprobado_observaciones: 'var(--warn)',
  no_aprobado: 'var(--danger)',
  archivado: 'var(--slate-400)',
}

// "resultados" no tiene su propio PDF: son solo 3 números que el gráfico
// "Resultados emitidos" ya muestra completos en pantalla -- exportarlos
// aparte no agrega ningún dato que no esté ahí.
const TIPOS_EXPORTAR: { tipo: 'expedientes' | 'evaluaciones'; label: string }[] = [
  { tipo: 'expedientes', label: 'Expedientes (PDF)' },
  { tipo: 'evaluaciones', label: 'Evaluaciones (PDF)' },
]

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export default function Reportes({ scopeLabel }: { scopeLabel: string }) {
  const [resumen, setResumen] = useState<ResumenReporte | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorExport, setErrorExport] = useState('')
  const [exportando, setExportando] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    reportesService
      .resumen()
      .then(r => !cancelado && setResumen(r))
      .catch(e => !cancelado && setError(e instanceof ApiError ? e.message : 'No se pudo cargar el reporte.'))
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
  }, [])

  async function exportar(tipo: 'expedientes' | 'evaluaciones') {
    setErrorExport('')
    setExportando(tipo)
    try {
      const blob = await reportesService.exportar(tipo)
      descargarBlob(blob, `${tipo}.pdf`)
    } catch (e) {
      setErrorExport(e instanceof ApiError ? e.message : 'No se pudo exportar.')
    } finally {
      setExportando(null)
    }
  }

  async function exportarReporte() {
    setErrorExport('')
    setExportando('reporte')
    try {
      const blob = await reportesService.exportarReporte()
      descargarBlob(blob, 'reporte-gestion.pdf')
    } catch (e) {
      setErrorExport(e instanceof ApiError ? e.message : 'No se pudo exportar el reporte.')
    } finally {
      setExportando(null)
    }
  }

  const metricas = resumen
    ? [
        { n: resumen.expedientes.total, label: 'Expedientes totales', color: 'var(--primary)' },
        { n: resumen.evaluadores.totalEvaluadores, label: 'Evaluadores', color: 'var(--navy)' },
        { n: Math.round(resumen.evaluadores.cargaPromedio * 10) / 10, label: 'Carga promedio', color: 'var(--warn)' },
        { n: resumen.evaluadores.cargaMaxima, label: 'Carga máxima', color: 'var(--success)' },
      ]
    : []

  const datosPorEstado: HBarDatum[] = resumen
    ? Object.entries(resumen.expedientes.porEstado)
        .filter(([, total]) => total > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([estado, total]) => ({
          key: estado,
          label: estadoLabel(estado),
          value: total,
          color: ESTADO_COLOR[estado] ?? 'var(--slate-400)',
        }))
    : []

  const datosCargaEvaluadores: HBarDatum[] = resumen
    ? [...resumen.cargaEvaluadores]
        .sort((a, b) => b.totalEvaluaciones - a.totalEvaluaciones)
        .map(c => ({
          key: String(c.evaluadorId),
          label: c.nombre ?? `Evaluador #${c.evaluadorId}`,
          value: c.totalEvaluaciones,
          color: 'var(--primary)',
        }))
    : []

  const datosResultados: StackedDatum[] = resumen
    ? resumen.resultados.map(r => ({
        key: r.tipo,
        label: estadoLabel(r.tipo),
        value: r.total,
        color: ESTADO_COLOR[r.tipo] ?? 'var(--slate-400)',
      }))
    : []

  const contenido = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <p className="field-error">{error}</p>}
      {cargando && <p className="muted small">Cargando reporte…</p>}

      {resumen && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {metricas.map(m => (
              <div key={m.label} className="card" style={{ flex: '1 1 140px', padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.n}</div>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--slate-500)' }}>{m.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Expedientes por estado</div>
            <HBarChart data={datosPorEstado} />
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Carga por evaluador</div>
            <HBarChart data={datosCargaEvaluadores} />
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Resultados emitidos</div>
            <StackedHBarChart data={datosResultados} />
          </div>

          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong style={{ fontSize: 13 }}>Exportar</strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIPOS_EXPORTAR.map(({ tipo, label }) => (
                <button
                  key={tipo}
                  className="btn btn-outline"
                  style={{ width: 'auto', padding: '8px 14px' }}
                  disabled={exportando === tipo}
                  onClick={() => exportar(tipo)}
                >
                  {exportando === tipo ? 'Descargando…' : label}
                </button>
              ))}
              <button
                className="btn btn-outline"
                style={{ width: 'auto', padding: '8px 14px' }}
                disabled={exportando === 'reporte'}
                onClick={exportarReporte}
              >
                {exportando === 'reporte' ? 'Descargando…' : 'Reporte con gráficos (PDF)'}
              </button>
            </div>
            {errorExport && <p className="field-error" style={{ margin: 0 }}>{errorExport}</p>}
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      <div className="mobile-only">
        <header className="topbar" style={{ borderBottom: '1px solid var(--line-soft)' }}>
          <h1>Reportes</h1>
        </header>
        <div className="screen-body" style={{ padding: '16px', gap: 14 }}>
          {contenido}
        </div>
        <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo={`Reportes · ${scopeLabel}`} />
          <div className="d-content">{contenido}</div>
        </div>
      </div>
    </>
  )
}
