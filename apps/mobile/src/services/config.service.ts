import { request } from '../lib/http'
import type { FechaLimiteDto } from '../types/api'

export function getFechaLimite(): Promise<FechaLimiteDto> {
  return request<FechaLimiteDto>('/config/fecha-limite')
}

export function setFechaLimite(fechaLimite: string | null): Promise<FechaLimiteDto> {
  return request<FechaLimiteDto>('/config/fecha-limite', { method: 'PUT', body: { fechaLimite } })
}
