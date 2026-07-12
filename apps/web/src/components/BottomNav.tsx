import { NavLink } from 'react-router-dom'
import { navItemsForRole, RUTA_CAMBIAR_TITULO } from './navConfig'
import { useApp } from '../state/AppContext'

function Icon({ d }: { d: string }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function BottomNav() {
  const { usuario } = useApp()
  // "Cambiar título" solo vive en el sidebar de escritorio: la barra móvil
  // mantiene sus 5 tabs fijos (Inicio, Proyectos, Nuevo, Consultas, Perfil).
  const items = navItemsForRole(usuario?.rol).filter(item => item.to !== RUTA_CAMBIAR_TITULO)

  return (
    <nav className="bottom-nav">
      {items.map(item =>
        item.to === '/nuevo' ? (
          <NavLink key={item.to} to={item.to} className={() => ''} style={{ color: 'var(--primary)' }}>
            <span className="fab">+</span>
            Nuevo
          </NavLink>
        ) : (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <Icon d={item.icon} />
            {item.label}
          </NavLink>
        ),
      )}
    </nav>
  )
}
