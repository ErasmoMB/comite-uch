// Roles válidos para el sistema completo (equivalente a `RolEnum` en
// comite/backend/app/models/__init__.py:7-19). A diferencia de
// `ROLES_AUTO_REGISTRO` (auth/constants.ts), que solo cubre los roles que
// pueden auto-registrarse, este set cubre TODOS los roles del sistema,
// incluidos los internos que solo el administrador puede asignar vía
// POST /users (comite/backend/app/api/users/routes.py:27-29).
export const ROLES_VALIDOS = [
  'administrador',
  'coordinador',
  'secretaria',
  'evaluador',
  'estudiante_pregrado',
  'estudiante_postgrado',
  'investigador',
  'estudiante',
] as const;

export type Rol = (typeof ROLES_VALIDOS)[number];
