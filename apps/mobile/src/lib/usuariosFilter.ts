// src/lib/usuariosFilter.ts
import type { RolBackend, UserDto } from '../types/api'

export type FiltroEstadoUsuario = 'todos' | 'activos' | 'inactivos'

export interface FiltroUsuarios {
  busqueda: string
  rol: RolBackend | 'todos'
  estado: FiltroEstadoUsuario
}

// Filtro puro de la lista de usuarios del Administrador: texto sobre
// nombre+apellido o email, dropdown de rol, y estado. Convención de estado
// calcada de la web (admin/Usuarios.tsx): activo = `activo !== false` (una fila
// con activo === null se considera activa); inactivo = `activo === false`. Se
// extrae como función pura y testeada, mismo precedente que expedienteListFilter.
export function filtrarUsuarios(usuarios: UserDto[], filtro: FiltroUsuarios): UserDto[] {
  const q = filtro.busqueda.trim().toLowerCase()
  return usuarios.filter(u => {
    const coincideTexto =
      !q ||
      `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    const coincideRol = filtro.rol === 'todos' || u.rol === filtro.rol
    const coincideEstado =
      filtro.estado === 'todos' ||
      (filtro.estado === 'activos' ? u.activo !== false : u.activo === false)
    return coincideTexto && coincideRol && coincideEstado
  })
}
