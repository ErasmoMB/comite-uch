// src/services/evaluacion.service.ts
import { apiUrl, request } from '../lib/http'
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

// POST /evaluacion/:id/guardar-parcial — SOLO persiste `observaciones`
// (limitación real del backend; NO guarda puntajes parciales). Devuelve
// {message}, NO un objeto de evaluación -> el consumidor NO debe pisar su
// estado local con esta respuesta.
export function guardarAvance(id: number, observaciones: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/evaluacion/${id}/guardar-parcial`, {
    method: 'POST',
    body: { observaciones },
  })
}

export interface CriterioInput {
  key: string
  puntaje: number
  observacion?: string
}

export interface EnviarEvaluacionPayload {
  observaciones: string
  completa: true
  criterios: CriterioInput[]
}

// PUT /evaluacion/:id — envío definitivo (completa: true). SÍ devuelve el
// objeto completo real (toResponse) -> se puede usar para refrescar estado.
export function enviarEvaluacion(id: number, payload: EnviarEvaluacionPayload): Promise<EvaluacionDetalleDto> {
  return request<EvaluacionDetalleDto>(`/evaluacion/${id}`, { method: 'PUT', body: payload })
}

// POST /evaluacion/:id/conflicto — irreversible. Devuelve {message}, NO un
// objeto de evaluación -> el consumidor solo marca conflictoInteres localmente.
export function declararConflicto(id: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/evaluacion/${id}/conflicto`, { method: 'POST' })
}

// URLs de descarga de PDFs (rúbrica/dictamen). Se pasan a abrirDocumento()
// (documentDownload.ts), que agrega el Bearer, sigue la redirección 302 a la
// URL firmada si aplica, y abre el share sheet nativo.
export function urlDescargarRubrica(id: number): string {
  return apiUrl(`/evaluacion/${id}/descargar-rubrica`)
}
export function urlDescargarDictamen(id: number): string {
  return apiUrl(`/evaluacion/${id}/descargar-dictamen`)
}
