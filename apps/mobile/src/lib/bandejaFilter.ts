// src/lib/bandejaFilter.ts
import { fechaLocalISO } from './dates'
import type { ExpedienteDto } from '../types/api'

// Estados que gestiona la secretaría: recién enviados, en revisión de fondo, o
// reingresados tras subsanación (igual que la web — el backend no filtra por
// estado en el query, se filtra client-side).
export const ESTADOS_BANDEJA = ['enviado', 'en_revision', 'subsanacion'] as const

export interface FiltroBandeja {
  busqueda: string
  fechaDesde: string
  fechaHasta: string
}

export function filtrarBandeja(expedientes: ExpedienteDto[], filtro: FiltroBandeja): ExpedienteDto[] {
  const q = filtro.busqueda.trim().toLowerCase()
  const lista = expedientes
    .filter(e => ESTADOS_BANDEJA.includes(e.estado as (typeof ESTADOS_BANDEJA)[number]))
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
