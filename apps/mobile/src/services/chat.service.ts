// src/services/chat.service.ts
import { request } from '../lib/http'
import type { MensajeChatDto } from '../types/api'

// Lado solicitante (investigador / estudiante_*)
export function getMiHilo(): Promise<MensajeChatDto[]> {
  return request<MensajeChatDto[]>('/chat/mios')
}

export function enviarComoSolicitante(texto: string): Promise<MensajeChatDto> {
  return request<MensajeChatDto>('/chat/mios', { method: 'POST', body: { texto } })
}

export function misNoLeidos(): Promise<{ noLeidos: number }> {
  return request('/chat/mios/no-leidos')
}
