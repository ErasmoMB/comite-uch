// src/lib/expedienteListFilter.ts
import { fechaLocalISO } from './dates'
import type { EstadoExpediente, ExpedienteDto } from '../types/api'

// Filtro compartido por las pantallas que listan expedientes (Bandeja de
// Secretaría, Dashboard de Coordinador, y futuras como la de Evaluador):
// búsqueda de texto sobre título/código/investigador, rango sobre
// `fechaEnvio` (vía fechaLocalISO), y orden por fechaEnvio descendente. Cada
// rol solo difiere en qué estados le corresponde ver, por lo que ese criterio
// se recibe como predicado.
export interface FiltroExpedientes {
  busqueda: string
  fechaDesde: string
  fechaHasta: string
}

export function filtrarExpedientes(
  expedientes: ExpedienteDto[],
  filtro: FiltroExpedientes,
  estadoPredicate: (estado: EstadoExpediente) => boolean,
): ExpedienteDto[] {
  const q = filtro.busqueda.trim().toLowerCase()
  const lista = expedientes
    .filter(e => estadoPredicate(e.estado))
    .filter(e => {
      const coincideTexto =
        !q ||
        e.tituloProtocolo.toLowerCase().includes(q) ||
        (e.codigoUnico ?? '').toLowerCase().includes(q) ||
        (e.investigadorNombre ?? '').toLowerCase().includes(q)
      const fechaExp = e.fechaEnvio ? fechaLocalISO(e.fechaEnvio) : null
      const coincideDesde = !filtro.fechaDesde || (fechaExp !== null && fechaExp >= filtro.fechaDesde)
      const coincideHasta = !filtro.fechaHasta || (fechaExp !== null && fechaExp <= filtro.fechaHasta)
      return coincideTexto && coincideDesde && coincideHasta
    })
  // Más reciente primero por fecha de envío.
  return [...lista].sort((a, b) => ((a.fechaEnvio ?? '') < (b.fechaEnvio ?? '') ? 1 : -1))
}
