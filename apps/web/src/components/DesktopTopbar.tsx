import type { ReactNode } from 'react'
import Avatar from './Avatar'
import { useApp } from '../state/AppContext'

interface Props {
  titulo?: ReactNode
  left?: ReactNode
  search?: boolean
  searchPlaceholder?: string
  bell?: boolean
  extra?: ReactNode
  withUserInfo?: boolean
}

export default function DesktopTopbar({
  titulo,
  left,
  search = false,
  searchPlaceholder = 'Buscar…',
  bell = false,
  extra,
  withUserInfo = false,
}: Props) {
  const { usuario, notificaciones, sheetNotifAbierta, abrirNotifs, marcarNotifsLeidas } = useApp()
  const hayNoLeidas = notificaciones.some(n => !n.leida)

  return (
    <header className="d-topbar">
      {left ??
        (search ? (
          <div className="d-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>{searchPlaceholder}</span>
          </div>
        ) : (
          <h1>{titulo}</h1>
        ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {extra}

        {bell && (
          <div style={{ position: 'relative' }}>
            <button
              className={`d-bell ${sheetNotifAbierta ? 'has-open' : ''}`}
              aria-label="Notificaciones"
              onClick={() => abrirNotifs(!sheetNotifAbierta)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={sheetNotifAbierta ? 'var(--primary)' : 'var(--slate-500)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a2 2 0 0 0 3.4 0" />
              </svg>
              {hayNoLeidas && <span className="dot" />}
            </button>

            {sheetNotifAbierta && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => abrirNotifs(false)} />
                <div className="d-notif-dropdown" onClick={e => e.stopPropagation()}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 14 }}>Notificaciones</strong>
                  <button className="link" onClick={marcarNotifsLeidas}>
                    Marcar todas
                  </button>
                </div>
                <div style={{ overflowY: 'auto' }}>
                  {notificaciones.length === 0 && (
                    <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>
                      No hay notificaciones.
                    </p>
                  )}
                  {notificaciones.map(n => (
                    <div
                      key={n.id}
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--row-line)',
                        background: n.leida ? '#fff' : 'var(--blue-50)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: n.leida ? 'var(--ink)' : 'var(--navy)' }}>{n.titulo}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 500, color: n.leida ? 'var(--slate-400)' : 'var(--primary)', flex: 'none' }}>
                          {n.codigoProyecto}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: n.leida ? 'var(--slate-500)' : 'var(--slate-700)' }}>{n.detalle}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--slate-400)', marginTop: 5 }}>{n.fecha}</div>
                    </div>
                  ))}
                </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="d-user">
          <Avatar size={36} />
          {withUserInfo && (
            <div>
              <div className="name">
                {usuario?.nombres} {usuario?.apellidos}
              </div>
              <div className="role">{usuario?.rol}</div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
