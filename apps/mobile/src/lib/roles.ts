// src/lib/roles.ts
import type { RolBackend } from '../types/api'
import { ROLES_SOLICITANTE } from '../data/types'

// Grupo de rutas de Expo Router que le corresponde a un rol. Distinta de
// `homePathForRole` de @comite/shared, que devuelve rutas WEB
// ('/secretaria/bandeja', etc.) y no aplica 1:1 a los grupos de carpetas de
// app/. Acá mapeamos rol -> grupo físico para router.replace / <Redirect>.
export type HomeGroup = '/(app)' | '/(secretaria)' | '/(coordinador)' | '/rol-no-disponible'

export function homeGroupForRole(rol: RolBackend): HomeGroup {
  if (ROLES_SOLICITANTE.includes(rol)) return '/(app)'
  if (rol === 'secretaria') return '/(secretaria)'
  if (rol === 'coordinador') return '/(coordinador)'
  // Roles internos aún no implementados (evaluador/administrador): NO se mandan
  // a '/(app)' (verían el Dashboard/wizard del solicitante con datos de todo el
  // sistema, confuso y engañoso). Se ampliará en fases futuras agregando sus
  // propios grupos y ramas aquí.
  return '/rol-no-disponible'
}
