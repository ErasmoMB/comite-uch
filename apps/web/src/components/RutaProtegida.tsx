import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Rol } from '../data/types'
import { homePathForRole } from '../data/types'
import { useApp } from '../state/AppContext'

interface Props {
  children: ReactNode
  roles?: Rol[]
}

export default function RutaProtegida({ children, roles }: Props) {
  const { usuario, cargandoSesion } = useApp()

  if (cargandoSesion) return null
  if (!usuario) return <Navigate to="/login" replace />
  if (roles && !roles.includes(usuario.rol)) return <Navigate to={homePathForRole(usuario.rol)} replace />

  return <>{children}</>
}
