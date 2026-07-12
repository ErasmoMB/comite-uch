import { request } from '../lib/http'
import type { RolBackend, UserDto } from '../types/api'

export function list(skip = 0, limit = 100): Promise<UserDto[]> {
  return request<UserDto[]>('/users', { query: { skip, limit } })
}

export function getById(id: number): Promise<UserDto> {
  return request<UserDto>(`/users/${id}`)
}

export interface CreateUserPayload {
  email: string
  password: string
  nombre: string
  apellido: string
  rol: RolBackend
  especialidad?: string
  cargaTrabajo?: number
  conflictoInteres?: boolean
}

export function create(payload: CreateUserPayload): Promise<UserDto> {
  return request<UserDto>('/users', { method: 'POST', body: payload })
}

export interface UpdateUserPayload {
  nombre?: string
  apellido?: string
  rol?: RolBackend
  activo?: boolean
}

export function update(id: number, payload: UpdateUserPayload): Promise<UserDto> {
  return request<UserDto>(`/users/${id}`, { method: 'PUT', body: payload })
}

export function deactivate(id: number): Promise<{ message: string }> {
  return request(`/users/${id}`, { method: 'DELETE' })
}

// A diferencia de deactivate() (soft-delete de siempre), esto borra la fila
// de verdad. Solo permitido para roles internos y solo si la cuenta no tiene
// evaluaciones/mensajes propios -- el backend rechaza el resto de casos.
export function eliminarPermanente(id: number): Promise<{ message: string }> {
  return request(`/users/${id}/permanente`, { method: 'DELETE' })
}

export async function evaluadoresDisponibles(): Promise<UserDto[]> {
  const usuarios = await list(0, 200)
  return usuarios.filter(u => u.rol === 'evaluador' && u.activo !== false)
}
