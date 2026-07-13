// src/services/evaluacion.service.ts
import { request } from '../lib/http'
import type { EvaluacionDto, RubricaDto } from '../types/api'

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

// ==================== Rol Evaluador (Fase 6) ====================

// Forma REAL de la respuesta de la API de evaluación (toResponse del backend,
// apps/api/src/evaluacion/evaluacion.service.ts:56-83). NO coincide con el
// EvaluacionDto compartido: usa `rubricaPdfUrl`/`dictamenPdfUrl` (no ...Path),
// no anida `expediente`/`evaluador`, y aplana título/investigador/fecha/creado.
// Mismo criterio que AsignarEvaluadorResponse: se tipa aparte a propósito.
export interface EvaluacionCriterioResp {
  criterioKey: string
  puntaje: number
  observacion: string | null
}

export interface EvaluacionDetalleDto {
  id: number
  expedienteId: number
  evaluadorId: number
  recommendation: string | null
  observaciones: string | null
  completa: boolean
  conflictoInteres: boolean
  tituloProtocolo: string | null
  investigadorNombre: string | null
  expedienteFechaEnvio: string | null
  criterios: EvaluacionCriterioResp[]
  puntajeTotal: number | null
  resultado: string | null
  rubricaPdfUrl: string | null
  dictamenPdfUrl: string | null
  createdAt: string | null
}

// GET /evaluacion/mis-evaluaciones y GET /evaluacion/:id comparten el mismo
// `toResponse`, así que su forma es idéntica: MiEvaluacionDto es un alias.
export type MiEvaluacionDto = EvaluacionDetalleDto

// GET /evaluacion/mis-evaluaciones — solo evaluadores; devuelve las evaluaciones
// asignadas al usuario logueado (forma aplanada, SIN codigoUnico).
export function misEvaluaciones(): Promise<MiEvaluacionDto[]> {
  return request<MiEvaluacionDto[]>('/evaluacion/mis-evaluaciones')
}

// GET /evaluacion/:id — detalle de una evaluación (misma forma aplanada).
export function getById(id: number): Promise<EvaluacionDetalleDto> {
  return request<EvaluacionDetalleDto>(`/evaluacion/${id}`)
}

// GET /evaluacion/rubrica — catálogo estático de los 7 criterios + umbrales.
// La forma real coincide 1:1 con el RubricaDto compartido, se reutiliza.
export function getRubrica(): Promise<RubricaDto> {
  return request<RubricaDto>('/evaluacion/rubrica')
}
