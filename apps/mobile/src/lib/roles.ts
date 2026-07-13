// src/lib/roles.ts
import type { RolBackend } from '../types/api'
import { ROLES_SOLICITANTE } from '../data/types'

// Grupo de rutas de Expo Router que le corresponde a un rol. Distinta de
// `homePathForRole` de @comite/shared, que devuelve rutas WEB
// ('/secretaria/bandeja', etc.) y no aplica 1:1 a los grupos de carpetas de
// app/. Acá mapeamos rol -> grupo físico para router.replace / <Redirect>.
export type HomeGroup =
  | '/(app)'
  | '/(secretaria)'
  | '/(coordinador)'
  | '/(evaluador)'
  | '/(administrador)'
  | '/rol-no-disponible'

export function homeGroupForRole(rol: RolBackend): HomeGroup {
  if (ROLES_SOLICITANTE.includes(rol)) return '/(app)'
  if (rol === 'secretaria') return '/(secretaria)'
  if (rol === 'coordinador') return '/(coordinador)'
  if (rol === 'evaluador') return '/(evaluador)'
  if (rol === 'administrador') return '/(administrador)'
  // Tras la Fase 7 los 7 roles del sistema tienen su grupo propio, así que
  // NINGÚN rol conocido llega ya hasta acá. Se conserva la rama como fallback
  // defensivo por si el backend introdujera un rol futuro/desconocido: en ese
  // caso se manda a /rol-no-disponible en vez de a '/(app)' (que mostraría el
  // wizard del solicitante con datos ajenos, confuso y engañoso).
  return '/rol-no-disponible'
}
