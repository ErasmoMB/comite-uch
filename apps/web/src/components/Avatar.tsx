import type { CSSProperties } from 'react'
import { ROL_LABEL, ROLES_SOLICITANTE } from '../data/types'
import { useApp } from '../state/AppContext'

function inicialesDeNombre(nombres?: string, apellidos?: string) {
  return `${nombres?.[0] ?? ''}${apellidos?.[0] ?? ''}`.toUpperCase() || 'U'
}

// Iniciales del ROL (no del nombre de la persona): primera letra de la
// primera y de la última palabra "significativa" de su etiqueta (se ignoran
// conectores cortos como "de"). Ej. "Secretaría" -> SE, "Estudiante de
// pregrado" -> EP, "Secretaría Técnica" -> ST.
function inicialesDeRol(etiqueta: string) {
  const palabras = etiqueta.split(/\s+/).filter(p => p.length > 2)
  if (palabras.length >= 2) {
    return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase()
  }
  return etiqueta.slice(0, 2).toUpperCase()
}

// Avatar del propio usuario logueado (esquina superior / "Mi perfil"):
// solicitantes (estudiante de pregrado/posgrado, investigador) ven las
// iniciales de SU nombre; roles internos (secretaría, coordinador,
// evaluador, administrador) ven las iniciales de su ROL en vez de su
// nombre — decisión explícita del Comité.
export default function Avatar({ size = 36, style }: { size?: number; style?: CSSProperties }) {
  const { usuario } = useApp()
  const esSolicitante = !!usuario && ROLES_SOLICITANTE.includes(usuario.rol)
  const texto = !usuario
    ? 'U'
    : esSolicitante
      ? inicialesDeNombre(usuario.nombres, usuario.apellidos)
      : inicialesDeRol(ROL_LABEL[usuario.rol] ?? usuario.rol)

  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34, ...style }}>
      {texto}
    </div>
  )
}
