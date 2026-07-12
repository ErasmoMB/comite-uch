import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../../components/BottomNav'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import ResizableTh from '../../components/ResizableTh'
import { fechaLocalISO, formatearFecha } from '../../lib/dates'
import { ApiError } from '../../lib/http'
import { useColumnResize } from '../../lib/useColumnResize'
import { evaluacionService, expedientesService } from '../../services'
import type { EvaluacionDto, ExpedienteDto } from '../../types/api'

interface Fila {
  evaluacion: EvaluacionDto
  expediente: ExpedienteDto | null
}

function EstadoEvaluacionBadge({ completa }: { completa: boolean }) {
  return completa ? (
    <span className="badge badge-aprobado">Completada</span>
  ) : (
    <span className="badge badge-en_revision">Pendiente</span>
  )
}

function ConflictoBadge() {
  return <span className="badge badge-observado">⚠ Conflicto de interés</span>
}

export default function Bandeja() {
  const navigate = useNavigate()
  const { templateColumns: COLUMNAS, iniciarArrastre } = useColumnResize([90, 240, 170, 100, 130, 130, 100])
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const evaluaciones = await evaluacionService.misEvaluaciones()
        const resueltas = await Promise.all(
          evaluaciones.map(async (evaluacion): Promise<Fila> => {
            if (evaluacion.expediente) return { evaluacion, expediente: evaluacion.expediente }
            try {
              const expediente = await expedientesService.getById(evaluacion.expedienteId)
              return { evaluacion, expediente }
            } catch {
              return { evaluacion, expediente: null }
            }
          }),
        )
        if (!cancelado) setFilas(resueltas)
      } catch (e) {
        if (!cancelado) setError(e instanceof ApiError ? e.message : 'No se pudieron cargar las evaluaciones asignadas.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [])

  function tituloDe(fila: Fila) {
    return fila.expediente?.tituloProtocolo ?? `Expediente #${fila.evaluacion.expedienteId}`
  }

  function codigoDe(fila: Fila) {
    return fila.expediente?.codigoUnico ?? '—'
  }

  function nombreSolicitanteDe(fila: Fila) {
    return fila.expediente?.investigadorNombre ?? '—'
  }

  const filasFiltradas = useMemo(() => {
    const lista = filas.filter(fila => {
      const q = busqueda.trim().toLowerCase()
      const coincideTexto =
        !q ||
        tituloDe(fila).toLowerCase().includes(q) ||
        codigoDe(fila).toLowerCase().includes(q) ||
        nombreSolicitanteDe(fila).toLowerCase().includes(q)
      const fecha = fila.expediente?.fechaEnvio ? fechaLocalISO(fila.expediente.fechaEnvio) : null
      const coincideDesde = !fechaDesde || (fecha !== null && fecha >= fechaDesde)
      const coincideHasta = !fechaHasta || (fecha !== null && fecha <= fechaHasta)
      return coincideTexto && coincideDesde && coincideHasta
    })
    // Más reciente primero por fecha de envío.
    return [...lista].sort((a, b) => (a.expediente?.fechaEnvio ?? '') < (b.expediente?.fechaEnvio ?? '') ? 1 : -1)
  }, [filas, busqueda, fechaDesde, fechaHasta])

  function limpiarFiltros() {
    setBusqueda('')
    setFechaDesde('')
    setFechaHasta('')
  }

  const vacio = !cargando && !error && filas.length === 0

  return (
    <>
      <div className="mobile-only">
        <header className="topbar">
          <h1>Bandeja de evaluaciones</h1>
        </header>

        <div className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--slate-400)"
              strokeWidth="2.2"
              strokeLinecap="round"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="input"
              style={{ paddingLeft: 38 }}
              placeholder="Buscar por código, título o estudiante…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 120px', margin: 0 }}>
              <label className="small muted" style={{ fontWeight: 500 }}>
                Desde
              </label>
              <input
                type="date"
                className="input"
                style={{ height: 38, fontSize: 13 }}
                value={fechaDesde}
                max={fechaHasta || undefined}
                onChange={e => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: '1 1 120px', margin: 0 }}>
              <label className="small muted" style={{ fontWeight: 500 }}>
                Hasta
              </label>
              <input
                type="date"
                className="input"
                style={{ height: 38, fontSize: 13 }}
                value={fechaHasta}
                min={fechaDesde || undefined}
                onChange={e => setFechaHasta(e.target.value)}
              />
            </div>
            <button
              className="link"
              style={{
                height: 38,
                padding: '0 14px',
                borderRadius: 10,
                background: 'var(--bg)',
                border: '1px solid var(--line-soft)',
                color: 'var(--slate-500)',
                fontSize: 13,
                flex: 'none',
              }}
              onClick={limpiarFiltros}
            >
              Limpiar
            </button>
          </div>

          {cargando && <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>Cargando evaluaciones…</p>}
          {error && <p className="field-error" style={{ textAlign: 'center', margin: '24px 0' }}>{error}</p>}
          {vacio && (
            <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>
              No tienes evaluaciones asignadas por el momento.
            </p>
          )}

          {filas.length > 0 && (
            <section className="card" style={{ overflow: 'hidden' }}>
              {filasFiltradas.map(fila => (
                <div
                  key={fila.evaluacion.id}
                  className="list-row"
                  style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                  onClick={() => navigate(`/evaluador/evaluacion/${fila.evaluacion.id}`)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tituloDe(fila)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-400)' }}>{nombreSolicitanteDe(fila)}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-400)' }}>
                      {codigoDe(fila)} · {formatearFecha(fila.expediente?.fechaEnvio ?? null)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flex: 'none' }}>
                    <EstadoEvaluacionBadge completa={fila.evaluacion.completa} />
                    {fila.evaluacion.conflictoInteres && <ConflictoBadge />}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Bandeja de evaluaciones" />
          <div className="d-content">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="d-search" style={{ width: 340 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input placeholder="Buscar por código, título o estudiante…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              </div>
              <span className="small muted" style={{ fontWeight: 500 }}>
                Desde
              </span>
              <input
                type="date"
                className="d-field"
                style={{ width: 150 }}
                value={fechaDesde}
                max={fechaHasta || undefined}
                onChange={e => setFechaDesde(e.target.value)}
              />
              <span className="small muted" style={{ fontWeight: 500 }}>
                Hasta
              </span>
              <input
                type="date"
                className="d-field"
                style={{ width: 150 }}
                value={fechaHasta}
                min={fechaDesde || undefined}
                onChange={e => setFechaHasta(e.target.value)}
              />
              <button className="link" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            </div>

            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="d-table-wrap">
              <div className="d-table-head" style={{ gridTemplateColumns: COLUMNAS }}>
                <ResizableTh onMouseDown={iniciarArrastre(0)}>CÓDIGO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(1)}>TÍTULO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(2)}>ESTUDIANTE</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(3)}>FECHA ENVÍO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(4)}>ESTADO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(5)}>CONFLICTO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(6)}>ACCIÓN</ResizableTh>
              </div>

              {cargando && <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>Cargando evaluaciones…</p>}
              {error && <p className="field-error" style={{ textAlign: 'center', margin: '24px 0' }}>{error}</p>}
              {vacio && (
                <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>
                  No tienes evaluaciones asignadas por el momento.
                </p>
              )}

              {filasFiltradas.map(fila => (
                <div key={fila.evaluacion.id} className="d-table-row" style={{ gridTemplateColumns: COLUMNAS }}>
                  <span>{codigoDe(fila)}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tituloDe(fila)}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                    {nombreSolicitanteDe(fila)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-500)' }}>
                    {formatearFecha(fila.expediente?.fechaEnvio ?? null)}
                  </span>
                  <span style={{ justifySelf: 'start' }}>
                    <EstadoEvaluacionBadge completa={fila.evaluacion.completa} />
                  </span>
                  <span style={{ justifySelf: 'start' }}>{fila.evaluacion.conflictoInteres ? <ConflictoBadge /> : <span className="muted small">—</span>}</span>
                  <button className="link" style={{ fontSize: 12 }} onClick={() => navigate(`/evaluador/evaluacion/${fila.evaluacion.id}`)}>
                    Ver evaluación ›
                  </button>
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
