import { request, requestBlob } from '../lib/http'

export interface TiempoAtencion {
  expedienteId: number
  codigo: string | null
  dias: number
  estado: string
}

export interface CargaEvaluador {
  evaluadorId: number
  nombre: string | null
  totalEvaluaciones: number
}

export interface ResultadoEmitido {
  tipo: string
  total: number
}

export interface ResumenReporte {
  fechaGeneracion: string
  expedientes: { total: number; porEstado: Record<string, number> }
  evaluadores: { totalEvaluadores: number; cargaPromedio: number; cargaMaxima: number }
  tiemposAtencion: TiempoAtencion[]
  cargaEvaluadores: CargaEvaluador[]
  resultados: ResultadoEmitido[]
}

export function expedientesPorEstado(): Promise<{ total: number; porEstado: Record<string, number> }> {
  return request('/reportes/expedientes-por-estado')
}

export function tiemposAtencion(): Promise<TiempoAtencion[]> {
  return request('/reportes/tiempos-atencion')
}

export function cargaEvaluadores(): Promise<CargaEvaluador[]> {
  return request('/reportes/carga-evaluadores')
}

export function resultadosEmitidos(): Promise<ResultadoEmitido[]> {
  return request('/reportes/resultados-emitidos')
}

export interface BuscarExpedientesQuery {
  estado?: string
  fechaInicio?: string
  fechaFin?: string
  [key: string]: string | undefined
}

export function buscarExpedientes(query: BuscarExpedientesQuery = {}): Promise<unknown[]> {
  return request('/reportes/buscar-expedientes', { query })
}

export function resumen(): Promise<ResumenReporte> {
  return request('/reportes/resumen')
}

// Devuelve el PDF real como blob -- el caller arma el <a download> (el
// nombre del archivo real lo decide el backend vía Content-Disposition, acá
// solo se necesita un nombre de respaldo por si ese header no llegara).
export function exportar(tipo: 'expedientes' | 'evaluaciones'): Promise<Blob> {
  return requestBlob('/reportes/exportar', { tipo })
}

// PDF de KPIs + gráficos -- descarga directa de un clic, sin diálogo de
// impresión del navegador de por medio.
export function exportarReporte(): Promise<Blob> {
  return requestBlob('/reportes/exportar-reporte')
}
