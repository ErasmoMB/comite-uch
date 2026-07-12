import type { RolBackend } from '@comite/shared'
import {
  ROLES_SOLICITANTE as SHARED_ROLES_SOLICITANTE,
  ROLES_AUTO_REGISTRO as SHARED_ROLES_AUTO_REGISTRO,
  ROL_LABEL as SHARED_ROL_LABEL,
  homePathForRole as sharedHomePath,
} from '@comite/shared'

export type EstadoProyecto =
  | 'borrador'
  | 'enviado'
  | 'en_revision'
  | 'subsanacion'
  | 'aprobado'
  | 'aprobado_observaciones'
  | 'no_aprobado'
  | 'archivado'

export type Rol = RolBackend

export interface DocumentoRequisito {
  id: number
  nombre: string
  detalle: string
  cargado: boolean
  archivo?: string
  tipoDocumento: string
}

export interface Observacion {
  id: string
  seccion: string
  detalle: string
}

export interface Autor {
  nombre: string
  rol: 'Autor' | 'Coautor'
  codigo: string
  correo: string
  telefono: string
}

export interface Proyecto {
  id: number
  codigo: string | null
  titulo: string
  programa: string
  ciclo: string
  estado: EstadoProyecto
  fechaEnvio: string | null
  fechaCreacion: string
  investigadorId: number
  autores: Autor[]
  documentos: DocumentoRequisito[]
  observaciones: Observacion[]
}

export interface Notificacion {
  id: number
  titulo: string
  detalle: string
  codigoProyecto: string
  fecha: string
  leida: boolean
}

export interface Mensaje {
  id: number
  de: 'yo' | 'secretaria'
  texto: string
  hora: string
  autorId: number
}

export interface Usuario {
  id: number
  nombres: string
  apellidos: string
  correo: string
  rol: Rol
  codigo: string | null
  programa?: string
  especialidad?: string | null
  cargaTrabajo?: number | null
  laboratorio?: string | null
}

export const ROLES_SOLICITANTE = SHARED_ROLES_SOLICITANTE
export const ROLES_AUTO_REGISTRO = SHARED_ROLES_AUTO_REGISTRO
export const ROL_LABEL = SHARED_ROL_LABEL
export const homePathForRole = sharedHomePath
