// src/lib/coordinadorFilter.ts
import { filtrarExpedientes, type FiltroExpedientes } from './expedienteListFilter'
import type { ExpedienteDto } from '../types/api'

export type FiltroCoordinador = FiltroExpedientes

// Expedientes que el coordinador gestiona: SOLO los que están en revisión de
// fondo (en_revision), listos para asignar evaluador. Mismo filtro client-side
// que la web (coordinador/Dashboard.tsx): texto sobre título/código/investigador
// y rango sobre `fechaEnvio`, orden por fechaEnvio descendente.
export function filtrarEnRevision(expedientes: ExpedienteDto[], filtro: FiltroCoordinador): ExpedienteDto[] {
  return filtrarExpedientes(expedientes, filtro, estado => estado === 'en_revision')
}
