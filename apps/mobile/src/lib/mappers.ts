import type { AutorExpedienteDto, DocumentoDto, ExpedienteDto, NotificacionDto, UserDto } from '../types/api'
import type { Autor, DocumentoRequisito, Notificacion, Proyecto, Usuario } from '../data/types'
import { formatearFechaHora } from './dates'

export function toDomainUser(dto: UserDto): Usuario {
  return {
    id: dto.id,
    nombres: dto.nombre,
    apellidos: dto.apellido,
    correo: dto.email,
    rol: dto.rol,
    codigo: dto.codigoEstudiante,
    especialidad: dto.especialidad,
    cargaTrabajo: dto.cargaTrabajo,
    laboratorio: dto.laboratorio,
  }
}

export function toDomainNotificacion(dto: NotificacionDto): Notificacion {
  return {
    id: dto.id,
    titulo: dto.titulo,
    detalle: dto.mensaje,
    codigoProyecto: dto.expedienteId ? `#${dto.expedienteId}` : '',
    fecha: formatearFechaHora(dto.createdAt),
    leida: dto.leida,
  }
}

function toDomainAutor(dto: AutorExpedienteDto): Autor {
  return {
    nombre: dto.apellidosNombres,
    rol: dto.esPrincipal ? 'Autor' : 'Coautor',
    codigo: dto.codigoEstudiante ?? '—',
    correo: dto.correo ?? '—',
    telefono: dto.telefono ?? '—',
  }
}

function toDomainDocumento(dto: DocumentoDto): DocumentoRequisito {
  return {
    id: dto.id,
    nombre: dto.nombreArchivo,
    detalle: dto.tipoDocumento,
    cargado: true,
    archivo: dto.nombreArchivo,
    tipoDocumento: dto.tipoDocumento,
  }
}

export function toDomainProyecto(dto: ExpedienteDto, documentos: DocumentoDto[] = []): Proyecto {
  return {
    id: dto.id,
    codigo: dto.codigoUnico,
    titulo: dto.tituloProtocolo,
    programa: dto.programaEstudios ?? dto.facultad ?? '—',
    ciclo: dto.ciclo ?? dto.nivelPosgrado ?? '—',
    estado: dto.estado,
    fechaEnvio: dto.fechaEnvio,
    fechaCreacion: dto.createdAt ?? '',
    investigadorId: dto.investigadorId,
    autores: (dto.autores ?? []).map(toDomainAutor),
    documentos: documentos.map(toDomainDocumento),
    observaciones: [],
  }
}

export const ESTADO_LABEL: Record<Proyecto['estado'], string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  en_revision: 'En revisión',
  subsanacion: 'Subsanación',
  aprobado: 'Aprobado',
  aprobado_observaciones: 'Aprobado c/ observ.',
  no_aprobado: 'No aprobado',
  archivado: 'Archivado',
}
