// src/services/evaluacion.service.ts
import { request } from '../lib/http'
import type { EvaluacionDto } from '../types/api'

// GET /evaluacion — un evaluador solo ve las suyas; coordinador/admin ven
// todas. El coordinador la usa para (a) marcar qué expedientes ya tienen
// evaluación asignada y (b) calcular la carga pendiente por evaluador.
export function list(skip = 0, limit = 100): Promise<EvaluacionDto[]> {
  return request<EvaluacionDto[]>('/evaluacion', { query: { skip, limit } })
}

// Forma REAL de la respuesta de POST /evaluacion/expediente/:id/asignar
// (apps/api/src/evaluacion/evaluacion.service.ts -> asignar(), líneas 207-212).
// NO es un EvaluacionDto: usa `evaluacionId` (no `id`) y no trae
// `expedienteId`/`completa`/`criterios`. Se tipa aparte a propósito para no
// mentirle al consumidor (el bug latente que la web arrastra al castear a
// EvaluacionDto y leer solo `evaluador.nombre/apellido`).
export interface AsignarEvaluadorResponse {
  message: string
  evaluacionId: number
  evaluador: { id: number; nombre: string; apellido: string }
  expedienteCodigo: string | null
}

// POST /evaluacion/expediente/:id/asignar — REGLA DURA de 1 evaluador por
// expediente (el backend responde 400 si ya tiene uno, incluida la carrera de
// dos coordinadores asignando casi a la vez).
export function asignarEvaluador(
  expedienteId: number,
  evaluadorId: number,
): Promise<AsignarEvaluadorResponse> {
  return request<AsignarEvaluadorResponse>(`/evaluacion/expediente/${expedienteId}/asignar`, {
    method: 'POST',
    body: { evaluadorId },
  })
}
