// src/lib/evaluacionBandejaFilter.ts
import { filtrarExpedientes, type FiltroExpedientes } from './expedienteListFilter'
import type { ExpedienteDto } from '../types/api'
import type { MiEvaluacionDto } from '../services/evaluacion.service'

export interface FilaEvaluacion {
  evaluacion: MiEvaluacionDto
  expediente: ExpedienteDto | null
}

// Reutiliza el filtro compartido de expedientes (texto sobre
// título/código/investigador + rango sobre fechaEnvio + orden desc) sobre la
// parte `expediente` de cada fila -- NO duplica la lógica de filtrado (mismo
// criterio que bandejaFilter.ts / coordinadorFilter.ts, que también delegan en
// filtrarExpedientes). Adaptación fina por la diferencia de forma: la Bandeja
// del evaluador lista objetos {evaluacion, expediente} y no filtra por estado
// (ve TODAS sus evaluaciones), por eso el predicado de estado es siempre-true.
// Las filas cuyo GET /expedientes/:id falló (expediente === null) no son
// filtrables por texto/fecha; se anexan al final SOLO cuando no hay filtros
// activos (mostrar lo que se tenga, igual criterio que la web).
export function filtrarEvaluacionesAsignadas(
  filas: FilaEvaluacion[],
  filtro: FiltroExpedientes,
): FilaEvaluacion[] {
  const porExpediente = new Map<number, FilaEvaluacion>()
  const expedientes: ExpedienteDto[] = []
  for (const fila of filas) {
    if (fila.expediente) {
      porExpediente.set(fila.expediente.id, fila)
      expedientes.push(fila.expediente)
    }
  }
  const ordenadas = filtrarExpedientes(expedientes, filtro, () => true)
    .map(e => porExpediente.get(e.id))
    .filter((f): f is FilaEvaluacion => f !== undefined)

  const hayFiltros =
    filtro.busqueda.trim() !== '' || filtro.fechaDesde !== '' || filtro.fechaHasta !== ''
  if (hayFiltros) return ordenadas
  const sinExpediente = filas.filter(f => f.expediente === null)
  return [...ordenadas, ...sinExpediente]
}
