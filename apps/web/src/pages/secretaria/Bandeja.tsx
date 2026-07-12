import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import BottomNav from '../../components/BottomNav'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import ResizableTh from '../../components/ResizableTh'
import { StatusBadge } from '../../components/shared'
import { fechaLocalISO, formatearFecha } from '../../lib/dates'
import { ApiError } from '../../lib/http'
import { useColumnResize } from '../../lib/useColumnResize'
import { expedientesService } from '../../services'
import type { ExpedienteDto } from '../../types/api'

// Estados que corresponden a gestión administrativa de la secretaría: recién
// enviados, en revisión de fondo, o reingresados tras una subsanación.
const ESTADOS_BANDEJA = ['enviado', 'en_revision', 'subsanacion'] as const

export default function Bandeja() {
  const navigate = useNavigate()
  const { templateColumns: COLUMNAS, iniciarArrastre } = useColumnResize([90, 240, 170, 100, 130, 90])
  const [expedientes, setExpedientes] = useState<ExpedienteDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      try {
        setCargando(true)
        const lista = await expedientesService.list()
        if (cancelado) return
        setExpedientes(lista)
        setError('')
      } catch (err) {
        if (cancelado) return
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la bandeja de expedientes.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [])

  const pendientes = useMemo(() => {
    const lista = expedientes
      .filter(e => ESTADOS_BANDEJA.includes(e.estado as (typeof ESTADOS_BANDEJA)[number]))
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

  return (
    <>
      <div className="mobile-only">
        <header className="topbar" style={{ justifyContent: 'space-between' }}>
          <h1>Bandeja de expedientes</h1>
          <Link to="/secretaria/perfil" style={{ textDecoration: 'none' }}>
            <Avatar size={40} />
          </Link>
        </header>

        <div className="screen-body" style={{ padding: '14px 16px 12px', gap: 12 }}>
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
              placeholder="Buscar por código, título o remitente…"
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

          <p className="small" style={{ margin: 0, fontWeight: 500, color: 'var(--slate-400)' }}>
            {cargando ? 'Cargando…' : `${pendientes.length} expediente(s) pendiente(s) de gestión`}
          </p>

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendientes.map(e => (
              <article
                key={e.id}
                className="card"
                style={{ padding: '13px 14px', cursor: 'pointer' }}
                onClick={() => navigate(`/secretaria/revision/${e.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <strong style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.tituloProtocolo}
                  </strong>
                  <StatusBadge estado={e.estado} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--slate-500)', marginBottom: 4 }}>
                  {e.investigadorNombre ?? 'Solicitante desconocido'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="small" style={{ fontWeight: 500, color: 'var(--slate-400)' }}>
                    {e.codigoUnico ?? '—'} · {formatearFecha(e.fechaEnvio)}
                  </span>
                  <button className="link" onClick={() => navigate(`/secretaria/revision/${e.id}`)}>
                    Revisar ›
                  </button>
                </div>
              </article>
            ))}
            {!cargando && pendientes.length === 0 && !error && (
              <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '24px 0' }}>
                No hay expedientes pendientes de gestión administrativa.
              </p>
            )}
          </div>
        </div>

        <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Bandeja de expedientes" />
          <div className="d-content">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="d-search" style={{ width: 340 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input placeholder="Buscar por código, título o remitente…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
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
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-400)' }}>
                {cargando ? 'Cargando…' : `${pendientes.length} expediente(s) pendiente(s) de gestión`}
              </span>
            </div>

            {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="d-table-wrap">
              <div className="d-table-head" style={{ gridTemplateColumns: COLUMNAS }}>
                <ResizableTh onMouseDown={iniciarArrastre(0)}>CÓDIGO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(1)}>TÍTULO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(2)}>REMITENTE</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(3)}>FECHA ENVÍO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(4)}>ESTADO</ResizableTh>
                <ResizableTh onMouseDown={iniciarArrastre(5)}>ACCIÓN</ResizableTh>
              </div>
              {pendientes.map(e => (
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
                  <button className="link" style={{ fontSize: 12 }} onClick={() => navigate(`/secretaria/revision/${e.id}`)}>
                    Revisar ›
                  </button>
                </div>
              ))}
              {!cargando && pendientes.length === 0 && !error && (
                <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '24px 0' }}>
                  No hay expedientes pendientes de gestión administrativa.
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
