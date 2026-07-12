import { useState } from 'react'
import { useApp } from '../state/AppContext'

export default function NotificationsSheet() {
  const { notificaciones, sheetNotifAbierta, abrirNotifs, marcarNotifsLeidas } = useApp()
  const [filtro, setFiltro] = useState<'todas' | 'noleidas'>('todas')

  if (!sheetNotifAbierta) return null

  const noLeidas = notificaciones.filter(n => !n.leida)
  const visibles = filtro === 'todas' ? notificaciones : noLeidas

  return (
    <div className="sheet-backdrop" onClick={() => abrirNotifs(false)}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong style={{ fontSize: 17 }}>Notificaciones</strong>
            <button className="link" onClick={marcarNotifsLeidas}>
              Marcar todas
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="badge"
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '8px 16px',
                fontSize: 13,
                background: filtro === 'todas' ? 'var(--primary)' : '#fff',
                color: filtro === 'todas' ? '#fff' : 'var(--slate-500)',
                boxShadow: filtro === 'todas' ? 'none' : 'inset 0 0 0 1px var(--line)',
              }}
              onClick={() => setFiltro('todas')}
            >
              Todas
            </button>
            <button
              className="badge"
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '8px 16px',
                fontSize: 13,
                background: filtro === 'noleidas' ? 'var(--primary)' : '#fff',
                color: filtro === 'noleidas' ? '#fff' : 'var(--slate-500)',
                boxShadow: filtro === 'noleidas' ? 'none' : 'inset 0 0 0 1px var(--line)',
              }}
              onClick={() => setFiltro('noleidas')}
            >
              No leídas · {noLeidas.length}
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibles.length === 0 && (
            <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>
              No hay notificaciones {filtro === 'noleidas' ? 'sin leer' : ''}.
            </p>
          )}
          {visibles.map(n => (
            <article
              key={n.id}
              className="card"
              style={{
                padding: '13px 14px',
                background: n.leida ? '#fff' : 'var(--blue-50)',
                borderColor: n.leida ? 'var(--line-soft)' : 'var(--blue-100)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ fontSize: 13.5, color: n.leida ? 'var(--ink)' : 'var(--navy)' }}>{n.titulo}</strong>
                <span className="small" style={{ color: n.leida ? 'var(--slate-400)' : 'var(--primary)', fontWeight: 500 }}>
                  {n.codigoProyecto}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: n.leida ? 'var(--slate-500)' : 'var(--slate-700)' }}>
                {n.detalle}
              </p>
              <p className="small" style={{ margin: '6px 0 0', color: 'var(--slate-400)', fontWeight: 500 }}>
                {n.fecha}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
