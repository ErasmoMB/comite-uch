// src/services/reportes.service.ts
import { apiUrl, request } from '../lib/http'

// Forma REAL de GET /reportes/resumen (apps/api/src/reportes/reportes.service.ts
// -> resumen(), líneas 225-236). @comite/shared NO exporta un ResumenReporte, así
// que se define acá contra la forma del backend (misma que
// apps/web/src/services/reportes.service.ts). tiemposAtencion se incluye por
// fidelidad aunque la pantalla de Reportes no lo consuma.
export interface CargaEvaluador {
  evaluadorId: number
  nombre: string | null
  totalEvaluaciones: number
}
export interface ResultadoEmitido {
  tipo: string
  total: number
}
export interface TiempoAtencion {
  expedienteId: number
  codigo: string | null
  dias: number
  estado: string
}
export interface ResumenReporte {
  fechaGeneracion: string
  expedientes: { total: number; porEstado: Record<string, number> }
  evaluadores: { totalEvaluadores: number; cargaPromedio: number; cargaMaxima: number }
  tiemposAtencion: TiempoAtencion[]
  cargaEvaluadores: CargaEvaluador[]
  resultados: ResultadoEmitido[]
}

// GET /reportes/resumen -- solo administrador/coordinador/secretaria (RolesGuard
// en el backend). Agrega todo lo que la pantalla de Reportes necesita en una
// sola llamada.
export function resumen(): Promise<ResumenReporte> {
  return request<ResumenReporte>('/reportes/resumen')
}

// Helpers de URL absoluta para abrirDocumento (documentDownload.ts): los
// endpoints de exportación devuelven un PDF real (Content-Disposition
// attachment) igual que los documentos del evaluador/secretaría, así que se
// descargan y abren con el mismo mecanismo (share sheet), sin plumbing nuevo.
export function urlExportar(tipo: 'expedientes' | 'evaluaciones'): string {
  return apiUrl(`/reportes/exportar?tipo=${tipo}`)
}
export function urlExportarReporte(): string {
  return apiUrl('/reportes/exportar-reporte')
}
