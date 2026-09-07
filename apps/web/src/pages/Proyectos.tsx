import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import ResizableTh from '../components/ResizableTh'
import { StatusBadge } from '../components/shared'
import type { Proyecto } from '../data/types'
import { fechaLocalISO, formatearFecha } from '../lib/dates'
import { ApiError } from '../lib/http'
import { toDomainProyecto } from '../lib/mappers'
import { useColumnResize } from '../lib/useColumnResize'
import { expedientesService } from '../services'
import { useConfirm } from '../state/ConfirmContext'

export default function Proyectos() {
  const { templateColumns: COLUMNAS, iniciarArrastre } = useColumnResize([110, 240, 150, 160, 150])
  const navigate = useNavigate()
  const confirmar = useConfirm()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const dtos = await expedientesService.list()
        if (activo) setProyectos(dtos.map(dto => toDomainProyecto(dto)))
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus proyectos.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const lista = proyectos.filter(p => {
      const q = busqueda.trim().toLowerCase()
      const coincideTexto = !q || p.titulo.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q)
      const fechaProyecto = p.fechaCreacion ? fechaLocalISO(p.fechaCreacion) : null
      const coincideDesde = !fechaDesde || (fechaProyecto !== null && fechaProyecto >= fechaDesde)
      const coincideHasta = !fechaHasta || (fechaProyecto !== null && fechaProyecto <= fechaHasta)
      return coincideTexto && coincideDesde && coincideHasta
    })
    // Siempre el más reciente primero, sin control manual de orden.
    return [...lista].sort((a, b) => (a.fechaCreacion < b.fechaCreacion ? 1 : -1))
  }, [proyectos, busqueda, fechaDesde, fechaHasta])

  async function eliminar(p: Proyecto) {
    if (!(await confirmar(`¿Eliminar el borrador "${p.titulo}"?`, { titulo: 'Eliminar borrador', textoConfirmar: 'Eliminar', peligroso: true }))) return
    try {
      await expedientesService.remove(p.id)
      setProyectos(prev => prev.filter(x => x.id !== p.id))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo eliminar el proyecto.')
    }
  }

  function accion(p: Proyecto) {
    switch (p.estado) {
      case 'subsanacion':
        return { texto: 'Subsanar ›', onClick: () => navigate(`/proyectos/${p.id}/subsanar`) }
      // Un borrador se retoma editando sus datos: es el atajo directo para
      // completar lo que quedó a medias antes de poder enviarlo.
      case 'borrador':
        return { texto: 'Continuar ›', onClick: () => navigate(`/proyectos/${p.id}/editar`) }
      default:
        return { texto: 'Ver detalle ›', onClick: () => navigate(`/proyectos/${p.id}`) }
    }
  }

  return (
    <>
      <div className="mobile-only">
      <header className="topbar" style={{ justifyContent: 'space-between' }}>
        <h1>Mis proyectos</h1>
        <Link to="/perfil" style={{ textDecoration: 'none' }}>
          <Avatar size={40} />
        </Link>
      </header>

      <div className="screen-body" style={{ padding: '14px 16px 12px', gap: 12 }}>
        <Link to="/cambiar-titulo" className="link" style={{ alignSelf: 'flex-start' }}>
          Cambiar título de un proyecto aprobado ›
        </Link>
        <Link to="/proyectos/rechazados" className="link" style={{ alignSelf: 'flex-start' }}>
          Mis proyectos rechazados ›
        </Link>
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
            placeholder="Buscar por código o título…"
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
            onClick={() => {
              setBusqueda('')
              setFechaDesde('')
              setFechaHasta('')
            }}
          >
            Limpiar
          </button>
        </div>

        {cargando && <p className="small muted">Cargando proyectos…</p>}
        {!cargando && error && <p className="field-error">{error}</p>}

        {!cargando && !error && (
          <>
            <p className="small" style={{ margin: 0, fontWeight: 500, color: 'var(--slate-400)' }}>
              Mostrando {filtrados.length} de {proyectos.length}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtrados.map(p => {
                const acc = accion(p)
                return (
                  <article key={p.id} className="card" style={{ padding: '13px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                      <strong style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.titulo}
                      </strong>
                      <StatusBadge estado={p.estado} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="small" style={{ fontWeight: 500, color: 'var(--slate-400)' }}>
                        {p.codigo ?? '—'} · {formatearFecha(p.fechaEnvio, 'sin enviar')}
                      </span>
                      {acc ? (
                        <button className="link" onClick={acc.onClick}>
                          {acc.texto}
                        </button>
                      ) : (
                        <button className="link" style={{ color: 'var(--danger)' }} onClick={() => eliminar(p)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
              {filtrados.length === 0 && (
                <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '24px 0' }}>
                  No se encontraron proyectos con esos filtros.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar
            titulo="Mis proyectos"
            extra={
              <>
                <button className="d-btn-ghost" onClick={() => navigate('/proyectos/rechazados')}>
                  Rechazados
                </button>
                <button className="d-btn-ghost" onClick={() => navigate('/cambiar-titulo')}>
                  Cambiar título
                </button>
                <button className="d-btn-primary" onClick={() => navigate('/nuevo')}>
                  + Nuevo proyecto
                </button>
              </>
            }
          />
          <div className="d-content">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="d-search" style={{ width: 340 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input placeholder="Buscar por código o título…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
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
              <button
                className="link"
                onClick={() => {
                  setBusqueda('')
                  setFechaDesde('')
                  setFechaHasta('')
                }}
              >
                Limpiar filtros
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-400)' }}>
                Mostrando {filtrados.length} de {proyectos.length}
              </span>
            </div>

            {cargando && <p className="small muted">Cargando proyectos…</p>}
            {!cargando && error && <p className="field-error">{error}</p>}

            {!cargando && !error && (
              <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="d-table-wrap">
                <div className="d-table-head" style={{ gridTemplateColumns: COLUMNAS }}>
                  <ResizableTh onMouseDown={iniciarArrastre(0)}>CÓDIGO</ResizableTh>
                  <ResizableTh onMouseDown={iniciarArrastre(1)}>TÍTULO</ResizableTh>
                  <ResizableTh onMouseDown={iniciarArrastre(2)}>FECHA ENVÍO</ResizableTh>
                  <ResizableTh onMouseDown={iniciarArrastre(3)}>ESTADO</ResizableTh>
                  <ResizableTh onMouseDown={iniciarArrastre(4)}>ACCIÓN</ResizableTh>
                </div>
                {filtrados.map(p => {
                  const acc = accion(p)
                  return (
                    <div key={p.id} className="d-table-row" style={{ gridTemplateColumns: COLUMNAS }}>
                      <span>{p.codigo ?? '—'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-500)' }}>{formatearFecha(p.fechaEnvio, 'sin enviar')}</span>
                      <span style={{ justifySelf: 'start' }}>
                        <StatusBadge estado={p.estado} />
                      </span>
                      {acc ? (
                        <button className="link" style={{ fontSize: 12 }} onClick={acc.onClick}>
                          {acc.texto}
                        </button>
                      ) : (
                        <button className="link" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={() => eliminar(p)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  )
                })}
                {filtrados.length === 0 && (
                  <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '24px 0' }}>
                    No se encontraron proyectos con esos filtros.
                  </p>
                )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
