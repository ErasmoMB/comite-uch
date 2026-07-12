import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { StatusBadge } from '../components/shared'
import type { Proyecto } from '../data/types'
import { formatearFecha } from '../lib/dates'
import { ApiError } from '../lib/http'
import { toDomainProyecto } from '../lib/mappers'
import { expedientesService } from '../services'
import { useApp } from '../state/AppContext'

// Fecha de cierre de la convocatoria vigente (demo)
const CIERRE = new Date('2026-07-08T23:59:59')

function useCuentaRegresiva() {
  const [restante, setRestante] = useState(CIERRE.getTime() - Date.now())
  useEffect(() => {
    const t = setInterval(() => setRestante(CIERRE.getTime() - Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor(restante / 1000))
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    min: Math.floor((s % 3600) / 60),
    seg: s % 60,
  }
}

export default function Dashboard() {
  const { usuario, notificaciones, abrirNotifs } = useApp()
  const navigate = useNavigate()
  const cr = useCuentaRegresiva()

  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const dtos = await expedientesService.list()
        // Orden más reciente primero (el backend no garantiza orden estable).
        const ordenados = [...dtos].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        if (activo) setProyectos(ordenados.map(dto => toDomainProyecto(dto)))
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

  const stats = [
    { n: proyectos.filter(p => p.estado === 'enviado' || p.estado === 'en_revision').length, label: 'Revisión', color: 'var(--primary)' },
    { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobado', color: 'var(--success)' },
    { n: proyectos.filter(p => p.estado === 'subsanacion').length, label: 'Subsanación', color: 'var(--warn)' },
    { n: proyectos.filter(p => p.estado === 'borrador').length, label: 'Borrador', color: 'var(--slate-500)' },
  ]

  const recientes = proyectos.slice(0, 3)
  const hayNoLeidas = notificaciones.some(n => !n.leida)

  return (
    <>
      <div className="mobile-only">
      <header className="topbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--slate-500)' }}>Buen día,</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            {usuario?.nombres} {usuario?.apellidos}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => abrirNotifs(true)}
            aria-label="Notificaciones"
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--bg)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--slate-500)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a2 2 0 0 0 3.4 0" />
            </svg>
            {hayNoLeidas && (
              <span
                style={{
                  position: 'absolute',
                  top: 7,
                  right: 8,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  border: '1.5px solid #fff',
                }}
              />
            )}
          </button>
          <Link to="/perfil" style={{ textDecoration: 'none' }}>
            <Avatar size={40} />
          </Link>
        </div>
      </header>

      <div className="screen-body" style={{ padding: '15px 16px 12px', gap: 14 }}>
        <section
          style={{
            background: 'linear-gradient(135deg, #08204A, #0b57b7)',
            borderRadius: 18,
            padding: '15px 17px',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 10 }}>
            Cierre de envíos de proyectos
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              [cr.dias, 'DÍAS'],
              [cr.horas, 'HRS'],
              [cr.min, 'MIN'],
              [cr.seg, 'SEG'],
            ].map(([n, l]) => (
              <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '9px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{String(n).padStart(2, '0')}</div>
                <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.8, letterSpacing: 0.8 }}>{l}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: 'flex', gap: 9 }}>
          {stats.map(s => (
            <div key={s.label} className="card" style={{ flex: 1, padding: '11px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: s.color }}>{s.n}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--slate-500)' }}>{s.label}</div>
            </div>
          ))}
        </section>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 15 }}>Mis proyectos recientes</strong>
          <Link to="/proyectos" className="link">
            Ver todos
          </Link>
        </div>

        <section className="card" style={{ overflow: 'hidden' }}>
          {cargando && (
            <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
              Cargando proyectos…
            </p>
          )}
          {!cargando && error && (
            <p className="field-error" style={{ padding: '13px 14px', margin: 0 }}>
              {error}
            </p>
          )}
          {!cargando &&
            !error &&
            recientes.map(p => (
              <div key={p.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/proyectos/${p.id}`)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.titulo}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-400)' }}>{p.codigo ?? 'Sin enviar'}</div>
                </div>
                <StatusBadge estado={p.estado} />
              </div>
            ))}
          {!cargando && !error && recientes.length === 0 && (
            <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
              Aún no tienes proyectos.
            </p>
          )}
        </section>
      </div>

      <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar search bell withUserInfo searchPlaceholder="Buscar proyecto, código…" />
          <div className="d-content">
            <div style={{ display: 'flex', gap: 20 }}>
              <section
                style={{
                  flex: 2,
                  background: 'linear-gradient(135deg, #08204A, #0b57b7)',
                  borderRadius: 16,
                  padding: '22px 26px',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85, marginBottom: 6 }}>
                    Cierre del periodo de envíos de proyectos
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    Quedan {cr.dias} días, {cr.horas} horas
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    [cr.dias, 'DÍAS'],
                    [cr.horas, 'HRS'],
                    [cr.min, 'MIN'],
                  ].map(([n, l]) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{String(n).padStart(2, '0')}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.8, letterSpacing: 0.8 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </section>
              <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                {stats.slice(0, 3).map(s => (
                  <div key={s.label} className="card" style={{ flex: 1, padding: '14px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.n}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--slate-500)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
              <div className="card" style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Mis proyectos recientes</span>
                  <Link to="/proyectos" className="link" style={{ fontSize: 12 }}>
                    Ver todos
                  </Link>
                </div>
                {cargando && (
                  <p className="small muted" style={{ padding: '16px 20px', margin: 0 }}>
                    Cargando proyectos…
                  </p>
                )}
                {!cargando && error && (
                  <p className="field-error" style={{ padding: '16px 20px', margin: 0 }}>
                    {error}
                  </p>
                )}
                {!cargando &&
                  !error &&
                  recientes.map(p => (
                    <div key={p.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/proyectos/${p.id}`)}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.titulo}</div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--slate-400)' }}>
                          {p.codigo ?? 'Sin enviar'} · {formatearFecha(p.fechaEnvio, 'sin enviar')}
                        </div>
                      </div>
                      <StatusBadge estado={p.estado} />
                    </div>
                  ))}
                {!cargando && !error && recientes.length === 0 && (
                  <p className="small muted" style={{ padding: '16px 20px', margin: 0 }}>
                    Aún no tienes proyectos.
                  </p>
                )}
              </div>
              <div className="card" style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Acciones rápidas</span>
                <button className="d-btn-primary" onClick={() => navigate('/nuevo')}>
                  + Nuevo proyecto
                </button>
                <button className="d-btn-ghost" onClick={() => navigate('/consultas')}>
                  Enviar consulta
                </button>
                <button className="d-btn-ghost" onClick={() => navigate('/proyectos')}>
                  Ver dictámenes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
