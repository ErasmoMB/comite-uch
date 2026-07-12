// src/services/expedientes.service.ts
import { request, uploadDocumento, type RNFile } from '../lib/http'
import type {
  AutorExpedienteDto, BitacoraDto, CatalogosDto, DocumentoDto, ElegibleCambioTituloDto,
  ExpedienteDto, HistorialDto, RequisitosDto,
} from '../types/api'

export function list(skip = 0, limit = 100): Promise<ExpedienteDto[]> {
  return request<ExpedienteDto[]>('/expedientes', { query: { skip, limit } })
}
export function getCatalogos(): Promise<CatalogosDto> {
  return request<CatalogosDto>('/expedientes/catalogos')
}
export function getElegiblesCambioTitulo(): Promise<ElegibleCambioTituloDto[]> {
  return request<ElegibleCambioTituloDto[]>('/expedientes/elegibles-cambio-titulo')
}
export function getRequisitos(id: number): Promise<RequisitosDto> {
  return request<RequisitosDto>(`/expedientes/${id}/requisitos`)
}
export function getBitacora(id: number): Promise<BitacoraDto[]> {
  return request<BitacoraDto[]>(`/expedientes/${id}/bitacora`)
}
export function getHistorial(id: number): Promise<HistorialDto[]> {
  return request<HistorialDto[]>(`/expedientes/${id}/historial`)
}
export function getDocumentos(id: number): Promise<DocumentoDto[]> {
  return request<DocumentoDto[]>(`/expedientes/${id}/documentos`)
}
export function getById(id: number): Promise<ExpedienteDto> {
  return request<ExpedienteDto>(`/expedientes/${id}`)
}
export async function getDetalle(id: number) {
  const [expediente, bitacora, historial, documentos] = await Promise.all([
    getById(id),
    getBitacora(id).catch(() => []),
    getHistorial(id).catch(() => []),
    getDocumentos(id).catch(() => []),
  ])
  return { expediente, bitacora, historial, documentos }
}

export interface CreateExpedientePayload {
  tituloProtocolo: string
  tipoTramite?: string
  facultad?: string
  programaEstudios?: string
  ciclo?: string
  nivelPosgrado?: string
  autores?: AutorExpedienteDto[]
}
export function create(payload: CreateExpedientePayload): Promise<ExpedienteDto> {
  return request<ExpedienteDto>('/expedientes', { method: 'POST', body: payload })
}

export interface CambioTituloPayload {
  proyectoOrigenId: number
  programaEstudios: string
  ciclo: string
  tituloNuevo: string
  autores?: AutorExpedienteDto[]
}
export function createCambioTitulo(payload: CambioTituloPayload): Promise<ExpedienteDto> {
  return request<ExpedienteDto>('/expedientes/cambio-titulo', { method: 'POST', body: payload })
}

export interface UpdateExpedientePayload {
  tituloProtocolo?: string
  tipoTramite?: string
  facultad?: string
  estado?: string
}
export function update(id: number, payload: UpdateExpedientePayload): Promise<ExpedienteDto> {
  return request<ExpedienteDto>(`/expedientes/${id}`, { method: 'PUT', body: payload })
}
export function remove(id: number): Promise<void> {
  return request(`/expedientes/${id}`, { method: 'DELETE' })
}
export function enviar(id: number): Promise<{ message: string; codigo?: string }> {
  return request(`/expedientes/${id}/enviar`, { method: 'POST' })
}
export function subsanar(id: number, observaciones: string): Promise<{ message: string; estado: string }> {
  return request(`/expedientes/${id}/subsanacion`, { method: 'POST', body: { observaciones } })
}

// Subida real de archivo queda para una fase posterior (expo-document-picker).
// La firma ya acepta el shape RNFile del picker: {uri,name,type}.
export function registrarDocumento(
  id: number,
  file: RNFile,
  opts: { tipoDocumento?: string; esObligatorio?: boolean } = {},
): Promise<DocumentoDto> {
  const fields: Record<string, string> = {}
  if (opts.tipoDocumento !== undefined) fields.tipoDocumento = opts.tipoDocumento
  if (opts.esObligatorio !== undefined) fields.esObligatorio = String(opts.esObligatorio)
  return uploadDocumento<DocumentoDto>(`/expedientes/${id}/documentos`, file, fields)
}

// NOTA: no se porta `descargarDocumento` (usa Blob del DOM); fuera de alcance de este corte.
