// src/services/auth.service.ts
import { clearToken, request, setToken } from '../lib/http'
import type { LoginResponse, RolBackend, UserDto } from '../types/api'

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload {
  email: string; password: string; nombre: string; apellido: string
  rol: RolBackend; codigoEstudiante?: string; laboratorio?: string
}

export async function login({ email, password }: LoginPayload): Promise<UserDto> {
  const { access_token } = await request<LoginResponse>('/auth/login', {
    method: 'POST', body: { username: email, password }, auth: false,
  })
  await setToken(access_token)
  return request<UserDto>('/users/me')
}
export async function register(payload: RegisterPayload): Promise<UserDto> {
  return request<UserDto>('/auth/register', { method: 'POST', body: payload, auth: false })
}
export async function getMe(): Promise<UserDto> {
  return request<UserDto>('/users/me')
}
export async function logout() {
  await clearToken()
}
export function solicitarRecuperacion(email: string): Promise<{ message: string }> {
  return request('/auth/recuperar/solicitar', { method: 'POST', body: { email }, auth: false })
}
export function verificarCodigoRecuperacion(email: string, codigo: string): Promise<{ message: string }> {
  return request('/auth/recuperar/verificar', { method: 'POST', body: { email, codigo }, auth: false })
}
export function cambiarPasswordRecuperacion(email: string, codigo: string, nuevaPassword: string): Promise<{ message: string }> {
  return request('/auth/recuperar/cambiar', { method: 'POST', body: { email, codigo, nuevaPassword }, auth: false })
}
