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

/**
 * Permite ocultar el botón cuando el servidor no tiene clave configurada, en
 * vez de mostrarlo y que falle al pulsarlo.
 */
export async function estado(): Promise<{ disponible: boolean }> {
  return request<{ disponible: boolean }>('/ia/estado')
}

export async function sugerirRubrica(
  evaluacionId: number,
  regenerar = false,
): Promise<SugerenciaRubricaDto> {
  return request<SugerenciaRubricaDto>(
    `/ia/evaluacion/${evaluacionId}/sugerir-rubrica`,
    { method: 'POST', query: regenerar ? { regenerar: 'true' } : undefined },
  )
}

export async function consultarExpediente(
  expedienteId: number,
  pregunta: string,
): Promise<{ respuesta: string; modelo: string }> {
  return request<{ respuesta: string; modelo: string }>(
    `/ia/expediente/${expedienteId}/consultar`,
    { method: 'POST', body: { pregunta } },
  )
}
