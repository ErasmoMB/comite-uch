import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import BottomNav from '../../components/BottomNav'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import ResizableTh from '../../components/ResizableTh'
import { StatusBadge } from '../../components/shared'
import { useApp } from '../../state/AppContext'
import { fechaLocalISO, formatearFecha } from '../../lib/dates'
import { ApiError } from '../../lib/http'
import { useColumnResize } from '../../lib/useColumnResize'
import { evaluacionService, expedientesService } from '../../services'
import type { EvaluacionDto, ExpedienteDto } from '../../types/api'

export default function Dashboard() {
  const { usuario } = useApp()
  const navigate = useNavigate()
  const { templateColumns: COLUMNAS, iniciarArrastre } = useColumnResize([90, 240, 170, 100, 150, 130, 120])

  const [expedientes, setExpedientes] = useState<ExpedienteDto[]>([])
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    let vivo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const [exps, evals] = await Promise.all([expedientesService.list(0, 500), evaluacionService.list(0, 500)])
        if (!vivo) return
        setExpedientes(exps)
        setEvaluaciones(evals)
      } catch (err) {
        if (!vivo) return
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los expedientes.')
      } finally {
        if (vivo) setCargando(false)
      }
    }
    cargar()
    return () => {
      vivo = false
    }
  }, [])

  const totalEnRevision = expedientes.filter(e => e.estado === 'en_revision').length
  const totalAprobado = expedientes.filter(e => e.estado === 'aprobado' || e.estado === 'aprobado_observaciones').length
  const totalNoAprobado = expedientes.filter(e => e.estado === 'no_aprobado').length
  const totalSubsanacion = expedientes.filter(e => e.estado === 'subsanacion').length

  const stats = [
    { n: totalEnRevision, label: 'En revisión', color: 'var(--primary)' },
    { n: totalAprobado, label: 'Aprobados', color: 'var(--success)' },
    { n: totalNoAprobado, label: 'No aprobados', color: 'var(--danger)' },
    { n: totalSubsanacion, label: 'Subsanación', color: 'var(--warn)' },
  ]

  const idsConEvaluacion = new Set(evaluaciones.map(e => e.expedienteId))

  const pendientesAsignacion = useMemo(() => {
    const lista = expedientes
      .filter(e => e.estado === 'en_revision')
      .filter(e => {
        const q = busqueda.trim().toLowerCase()
        const coincideTexto =
          !q ||
          e.tituloProtocolo.toLowerCase().includes(q) ||
          (e.codigoUnico ?? '').toLowerCase().includes(q) ||
          (e.investigadorNombre ?? '').toLowerCase().includes(q)
        const fechaExp = e.fechaEnvio ? fechaLocalISO(e.fechaEnvio) : null
        const coincideDesde = !fechaDesde || (fechaExp !== null && fechaExp >= fechaDesde)
        const coincideHasta = !fechaHasta || (fechaExp !== null && fechaExp <= fechaHasta)
        return coincideTexto && coincideDesde && coincideHasta
      })
    // Más reciente primero por fecha de envío.
    return [...lista].sort((a, b) => (a.fechaEnvio ?? '') < (b.fechaEnvio ?? '') ? 1 : -1)
  }, [expedientes, busqueda, fechaDesde, fechaHasta])

  function limpiarFiltros() {
    setBusqueda('')
    setFechaDesde('')
    setFechaHasta('')
  }

  function AsignacionCell({ expediente }: { expediente: ExpedienteDto }) {
    const asignado = idsConEvaluacion.has(expediente.id)
    return asignado ? (
      <span className="badge badge-aprobado">En evaluación</span>
    ) : (
      <span className="badge badge-subsanacion">Pendiente de asignar</span>
    )
  }

  function AccionCell({ expediente }: { expediente: ExpedienteDto }) {
    const asignado = idsConEvaluacion.has(expediente.id)
    return (
      <button className="link" onClick={() => navigate(`/coordinador/asignacion/${expediente.id}`)}>
        {asignado ? 'Ver asignación ›' : 'Asignar evaluador ›'}
      </button>
    )
  }

  return (
    <>
      <div className="mobile-only">
        <header className="topbar" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--slate-500)' }}>Panel de coordinación</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {usuario?.nombres} {usuario?.apellidos}
            </div>
          </div>
          <Link to="/coordinador/perfil" style={{ textDecoration: 'none' }}>
            <Avatar size={40} />
          </Link>
        </header>

        <div className="screen-body" style={{ padding: '15px 16px 24px', gap: 14 }}>
          {error && (
            <div className="card" style={{ padding: '12px 14px', color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <section style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {stats.map(s => (
              <div key={s.label} className="card" style={{ flex: '1 1 45%', padding: '11px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 21, fontWeight: 700, color: s.color }}>{s.n}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--slate-500)' }}>{s.label}</div>
              </div>
            ))}
          </section>

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

          <strong style={{ fontSize: 15 }}>Expedientes en revisión ({pendientesAsignacion.length})</strong>

          <section className="card" style={{ overflow: 'hidden' }}>
            {cargando && (
              <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
                Cargando expedientes…
              </p>
            )}
            {!cargando &&
              pendientesAsignacion.map(e => (
                <div key={e.id} className="list-row" style={{ flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.tituloProtocolo}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-400)' }}>{e.investigadorNombre ?? 'Solicitante desconocido'}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-400)' }}>
                      {e.codigoUnico ?? 'Sin código'} · {formatearFecha(e.fechaEnvio)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <AsignacionCell expediente={e} />
                    <AccionCell expediente={e} />
                  </div>
                </div>
              ))}
            {!cargando && pendientesAsignacion.length === 0 && (
              <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
                No hay expedientes en revisión por el momento.
              </p>
            )}
          </section>
        </div>

        <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Panel de coordinación" bell withUserInfo />
          <div className="d-content">
            {error && (
              <div className="card" style={{ padding: '14px 18px', color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 14 }}>
              {stats.map(s => (
                <div
                  key={s.label}
                  className="card"
                  style={{ flex: 1, padding: '16px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                >
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.n}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--slate-500)' }}>{s.label}</div>
                </div>
              ))}
            </div>

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

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Expedientes en revisión</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-400)' }}>{pendientesAsignacion.length} en total</span>
              </div>
              <div className="d-table-wrap">
              <div className="d-table-head" style={{ gridTemplateColumns: COLUMNAS }}>
                <ResizableTh onMouseDown={iniciarArrastre(0)}>CÓDIGO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(1)}>TÍTULO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(2)}>ESTUDIANTE</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(3)}>FECHA ENVÍO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(4)}>ESTADO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(5)}>ASIGNACIÓN</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(6)}>ACCIÓN</ResizableTh>
              </div>
              {cargando && (
                <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '24px 0' }}>
                  Cargando expedientes…
                </p>
              )}
              {!cargando &&
                pendientesAsignacion.map(e => (
                  <div key={e.id} className="d-table-row" style={{ gridTemplateColumns: COLUMNAS }}>
                    <span>{e.codigoUnico ?? '—'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.tituloProtocolo}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                      {e.investigadorNombre ?? '—'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-500)' }}>{formatearFecha(e.fechaEnvio)}</span>
                    <span style={{ justifySelf: 'start' }}>
                      <StatusBadge estado={e.estado} />
                    </span>
                    <span style={{ justifySelf: 'start' }}>
                      <AsignacionCell expediente={e} />
                    </span>
                    <AccionCell expediente={e} />
                  </div>
                ))}
              {!cargando && pendientesAsignacion.length === 0 && (
                <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '24px 0' }}>
                  No hay expedientes en revisión por el momento.
                </p>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
