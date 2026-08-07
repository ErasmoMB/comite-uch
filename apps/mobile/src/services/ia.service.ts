import { request } from '../lib/http'

export interface SugerenciaCriterio {
  key: string
  puntaje: number
  justificacion: string
  cita: string
}

export interface SugerenciaRubricaDto {
  criterios: SugerenciaCriterio[]
  modelo: string
  generadaEn: string
  /** true si vino de lo guardado y no se volvió a llamar al modelo. */
  desdeCache: boolean
}

/** Permite ocultar el botón si el servidor no tiene clave configurada. */
export async function estado(): Promise<{ disponible: boolean }> {
  return request<{ disponible: boolean }>('/ia/estado')
}

export async function sugerirRubrica(
  evaluacionId: number,
  regenerar = false,
): Promise<SugerenciaRubricaDto> {
  return request<SugerenciaRubricaDto>(`/ia/evaluacion/${evaluacionId}/sugerir-rubrica`, {
    method: 'POST',
    query: regenerar ? { regenerar: 'true' } : undefined,
  })
}

export interface DocumentoConsultable {
  id: number
  tipoDocumento: string
  label: string
  nombreArchivo: string
}

/** Documentos del expediente sobre los que el asistente puede responder. */
export async function documentosConsultables(
  expedienteId: number,
): Promise<DocumentoConsultable[]> {
  return request<DocumentoConsultable[]>(`/ia/expediente/${expedienteId}/documentos`)
}

export async function consultarExpediente(
  expedienteId: number,
  pregunta: string,
  documentoId?: number,
): Promise<{ respuesta: string; modelo: string; documento: string }> {
  return request<{ respuesta: string; modelo: string; documento: string }>(
    `/ia/expediente/${expedienteId}/consultar`,
    { method: 'POST', body: { pregunta, ...(documentoId ? { documentoId } : {}) } },
  )
}
