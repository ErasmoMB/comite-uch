import { NavLink, useNavigate } from 'react-router-dom'
import { navItemsForRole } from './navConfig'
import { APP_NOMBRE, APP_SUBTITULO, MOSTRAR_LOGO } from '../lib/marca'
import { useApp } from '../state/AppContext'

function Icon({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function DesktopSidebar() {
  const { usuario, logout } = useApp()
  const navigate = useNavigate()
  const items = navItemsForRole(usuario?.rol)
  const perfilItem = items[items.length - 1]
  const principales = items.slice(0, -1)

  function cerrarSesion() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="d-sidebar">
      <div className="d-sb-logo">
        {MOSTRAR_LOGO && <img src="/uch.png" alt="UCH" className="d-sb-mark" />}
        <div>
          <div className="d-sb-title">{APP_NOMBRE}</div>
          <div className="d-sb-sub">{APP_SUBTITULO}</div>
        </div>
      </div>

      {principales.map(item => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `d-nav-item ${isActive ? 'active' : ''}`}>
          <Icon d={item.icon} />
          {item.label}
        </NavLink>
      ))}

      <div className="d-nav-sec">CUENTA</div>
      <NavLink to={perfilItem.to} className={({ isActive }) => `d-nav-item ${isActive ? 'active' : ''}`}>
        <Icon d={perfilItem.icon} />
        {perfilItem.label}
      </NavLink>

      <div style={{ flex: 1 }} />
      <button className="d-nav-item" style={{ color: 'rgba(255,255,255,.4)' }} onClick={cerrarSesion}>
        <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        Cerrar sesión
      </button>
    </nav>
  )
}
