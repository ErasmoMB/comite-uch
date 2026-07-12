import { request } from '../lib/http'
import type { NotificacionDto } from '../types/api'

export function list(skip = 0, limit = 50): Promise<NotificacionDto[]> {
  return request<NotificacionDto[]>('/notificaciones', { query: { skip, limit } })
}

export function sinLeer(): Promise<{ sinLeer: number }> {
  return request('/notificaciones/sin-leer')
}

export function marcarTodasLeidas(): Promise<void> {
  return request('/notificaciones/marcar-todas-leidas', { method: 'POST' })
}

export function marcarLeida(id: number, leida = true): Promise<NotificacionDto> {
  return request(`/notificaciones/${id}`, { method: 'PUT', body: { leida } })
}
