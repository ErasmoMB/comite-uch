import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { StatusBadge, TopBar } from '../components/shared'
import { formatearFecha } from '../lib/dates'
import { ApiError } from '../lib/http'
import { expedientesService } from '../services'
import type { ExpedienteRechazadoDto } from '../types/api'

// Observación 4 del Comité: vista "Mis proyectos rechazados" — proyectos
// propios rechazados u observados, con lo que hay que levantar y cuántos
// intentos de reenvío quedan (tope de 3 por expediente).
export default function MisRechazados() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ExpedienteRechazadoDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const res = await expedientesService.getMisRechazados()
        if (activo) setItems(res)
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus proyectos rechazados.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [])

  function tarjeta(p: ExpedienteRechazadoDto) {
    return (
      <article key={p.id} className="card" style={{ padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.tituloProtocolo}</strong>
          <StatusBadge estado={p.estado} />
        </div>
        <span className="small" style={{ fontWeight: 500, color: 'var(--slate-400)' }}>
          {p.codigoUnico ?? '—'} · {formatearFecha(p.fechaEnvio, 'sin enviar')} · Intento {p.intentos} de {p.intentosMaximos}
        </span>

        {p.observaciones.length > 0 && (
          <div
            style={{
              background: 'var(--warn-bg)',
              border: '1px solid var(--warn-line)',
              borderLeft: '3px solid var(--warn)',
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {p.observaciones.map((o, i) => (
              <p key={i} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--warn-ink)' }}>
                <strong>{o.origen}:</strong> {o.texto}
              </p>
            ))}
          </div>
        )}

        {p.puedeReenviar ? (
          <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(`/proyectos/${p.id}/reenviar`)}>
            Levantar observaciones y reenviar ›
          </button>
        ) : (
          <p className="small field-error" style={{ margin: 0 }}>
            {p.motivoBloqueo}
          </p>
        )}
      </article>
    )
  }

  return (
    <>
      <div className="mobile-only">
        <TopBar titulo="Proyectos rechazados" />
        <div className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }}>
          {cargando && <p className="small muted">Cargando…</p>}
          {!cargando && error && <p className="field-error">{error}</p>}
          {!cargando && !error && items.length === 0 && (
            <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '24px 0' }}>
              No tienes proyectos rechazados u observados pendientes.
            </p>
          )}
          {!cargando && !error && items.map(tarjeta)}
          <Link to="/proyectos" className="link" style={{ alignSelf: 'flex-start' }}>
            ‹ Volver a mis proyectos
          </Link>
        </div>
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Proyectos rechazados" />
          <div className="d-content" style={{ gap: 12 }}>
            {cargando && <p className="small muted">Cargando…</p>}
            {!cargando && error && <p className="field-error">{error}</p>}
            {!cargando && !error && items.length === 0 && (
              <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '24px 0' }}>
                No tienes proyectos rechazados u observados pendientes.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{!cargando && !error && items.map(tarjeta)}</div>
          </div>
        </div>
      </div>
    </>
  )
}
