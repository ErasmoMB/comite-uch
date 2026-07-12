import type { Rol } from '../data/types'

export interface NavItem {
  to: string
  label: string
  end?: boolean
  icon: string
}

const ICONS = {
  inicio: 'M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3z',
  proyectos: 'M4 4h9l3 3h4v13H4z M4 4v16',
  nuevo: 'M12 5v14M5 12h14',
  consultas: 'M21 12a8 8 0 0 1-8 8H3l2.5-3A8 8 0 1 1 21 12z',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  bandeja: 'M3 8.5 12 4l9 4.5M3 8.5V19h18V8.5M3 8.5l7 4.5h4l7-4.5',
  asignacion: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  reportes: 'M4 19h16M7 15v3M12 10v8M17 6v12',
  usuarios: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  configuracion: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  chat: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  revision: 'M9 12l2 2 4-4M7.8 3h8.4L21 7.8v8.4L16.2 21H7.8L3 16.2V7.8z',
  cambiarTitulo: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
}

// Ruta sin :id — no se muestra en la barra inferior móvil (queda solo en el
// sidebar de escritorio) para no saturar los 5 tabs fijos del bottom nav.
export const RUTA_CAMBIAR_TITULO = '/cambiar-titulo'

export function navItemsForRole(rol: Rol | undefined): NavItem[] {
  switch (rol) {
    case 'secretaria':
      return [
        { to: '/secretaria/bandeja', label: 'Bandeja', end: true, icon: ICONS.bandeja },
        { to: '/secretaria/chat', label: 'Chat', icon: ICONS.chat },
        { to: '/secretaria/perfil', label: 'Mi perfil', icon: ICONS.perfil },
      ]
    case 'coordinador':
      return [
        { to: '/coordinador/dashboard', label: 'Inicio', end: true, icon: ICONS.inicio },
        { to: '/coordinador/perfil', label: 'Mi perfil', icon: ICONS.perfil },
      ]
    case 'evaluador':
      return [
        { to: '/evaluador/bandeja', label: 'Bandeja', end: true, icon: ICONS.bandeja },
        { to: '/evaluador/perfil', label: 'Mi perfil', icon: ICONS.perfil },
      ]
    case 'administrador':
      return [
        { to: '/admin/usuarios', label: 'Usuarios', end: true, icon: ICONS.usuarios },
        { to: '/admin/configuracion', label: 'Configuración', icon: ICONS.configuracion },
        { to: '/admin/reportes', label: 'Reportes', icon: ICONS.reportes },
        { to: '/admin/perfil', label: 'Mi perfil', icon: ICONS.perfil },
      ]
    default:
      return [
        { to: '/', label: 'Inicio', end: true, icon: ICONS.inicio },
        { to: '/proyectos', label: 'Mis proyectos', icon: ICONS.proyectos },
        { to: '/nuevo', label: 'Nuevo proyecto', icon: ICONS.nuevo },
        { to: RUTA_CAMBIAR_TITULO, label: 'Cambiar título', icon: ICONS.cambiarTitulo },
        { to: '/consultas', label: 'Consultas', icon: ICONS.consultas },
        { to: '/perfil', label: 'Mi perfil', icon: ICONS.perfil },
      ]
  }
}
