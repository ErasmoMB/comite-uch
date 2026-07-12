import { apiUrl, request } from '../lib/http'
import type { EvaluacionDto, RubricaDto } from '../types/api'

export function getRubrica(): Promise<RubricaDto> {
  return request<RubricaDto>('/evaluacion/rubrica')
}

export function misEvaluaciones(): Promise<EvaluacionDto[]> {
  return request<EvaluacionDto[]>('/evaluacion/mis-evaluaciones')
}

export function list(skip = 0, limit = 100): Promise<EvaluacionDto[]> {
  return request<EvaluacionDto[]>('/evaluacion', { query: { skip, limit } })
}

export function create(expedienteId: number): Promise<EvaluacionDto> {
  return request<EvaluacionDto>('/evaluacion', { method: 'POST', body: { expedienteId } })
}

export function asignarEvaluador(expedienteId: number, evaluadorId: number): Promise<EvaluacionDto> {
  return request<EvaluacionDto>(`/evaluacion/expediente/${expedienteId}/asignar`, {
    method: 'POST',
    body: { evaluadorId },
  })
}

export function getById(id: number): Promise<EvaluacionDto> {
  return request<EvaluacionDto>(`/evaluacion/${id}`)
}

export interface CriterioInput {
  key: string
  puntaje: number
  observacion?: string
}

export interface UpdateEvaluacionPayload {
  recommendation?: string
  observaciones?: string
  completa?: boolean
  criterios?: CriterioInput[]
}

export function update(id: number, payload: UpdateEvaluacionPayload): Promise<EvaluacionDto> {
  return request<EvaluacionDto>(`/evaluacion/${id}`, { method: 'PUT', body: payload })
}

export function guardarParcial(id: number, observaciones: string): Promise<EvaluacionDto> {
  return request<EvaluacionDto>(`/evaluacion/${id}/guardar-parcial`, { method: 'POST', body: { observaciones } })
}

export function declararConflicto(id: number): Promise<EvaluacionDto> {
  return request<EvaluacionDto>(`/evaluacion/${id}/conflicto`, { method: 'POST' })
}

export function urlDescargarRubrica(id: number) {
  return apiUrl(`/evaluacion/${id}/descargar-rubrica`)
}

export function urlDescargarDictamen(id: number) {
  return apiUrl(`/evaluacion/${id}/descargar-dictamen`)
}

// 1 evaluador por expediente (regla dura del backend). Asigna el primer
// candidato de la lista y lo notifica; si ya hay un evaluador asignado no
// hace nada.
export async function asignarUnEvaluador(expedienteId: number, evaluadorId: number) {
  const existentes = await list(0, 500)
  const yaAsignado = existentes.some(e => e.expedienteId === expedienteId)
  if (yaAsignado) throw new Error('Este expediente ya tiene un evaluador asignado.')
  return asignarEvaluador(expedienteId, evaluadorId)
}
