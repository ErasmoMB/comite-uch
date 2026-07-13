// src/lib/coordinadorFilter.ts
import { fechaLocalISO } from './dates'
import type { ExpedienteDto } from '../types/api'

export interface FiltroCoordinador {
  busqueda: string
  fechaDesde: string
  fechaHasta: string
}

// Expedientes que el coordinador gestiona: SOLO los que están en revisión de
// fondo (en_revision), listos para asignar evaluador. Mismo filtro client-side
// que la web (coordinador/Dashboard.tsx): texto sobre título/código/investigador
// y rango sobre `fechaEnvio`, orden por fechaEnvio descendente.
export function filtrarEnRevision(expedientes: ExpedienteDto[], filtro: FiltroCoordinador): ExpedienteDto[] {
  const q = filtro.busqueda.trim().toLowerCase()
  const lista = expedientes
    .filter(e => e.estado === 'en_revision')
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
