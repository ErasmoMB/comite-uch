// src/lib/bandejaFilter.ts
import { filtrarExpedientes, type FiltroExpedientes } from './expedienteListFilter'
import type { ExpedienteDto } from '../types/api'

// Estados que gestiona la secretaría: recién enviados, en revisión de fondo, o
// reingresados tras subsanación (igual que la web — el backend no filtra por
// estado en el query, se filtra client-side).
export const ESTADOS_BANDEJA = ['enviado', 'en_revision', 'subsanacion'] as const

export type FiltroBandeja = FiltroExpedientes

export function filtrarBandeja(expedientes: ExpedienteDto[], filtro: FiltroBandeja): ExpedienteDto[] {
  return filtrarExpedientes(expedientes, filtro, estado =>
    ESTADOS_BANDEJA.includes(estado as (typeof ESTADOS_BANDEJA)[number]),
  )
}
