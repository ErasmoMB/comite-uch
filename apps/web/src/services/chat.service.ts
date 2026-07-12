import { request } from '../lib/http'
import type { ConversacionChatDto, MensajeChatDto, SolicitanteChatDto } from '../types/api'

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

// Lado secretaría / administrador
export function getConversaciones(): Promise<ConversacionChatDto[]> {
  return request<ConversacionChatDto[]>('/chat/conversaciones')
}

export function getSolicitantes(): Promise<SolicitanteChatDto[]> {
  return request<SolicitanteChatDto[]>('/chat/solicitantes')
}

export function totalNoLeidos(): Promise<{ noLeidos: number }> {
  return request('/chat/no-leidos')
}

export function getHiloDeSolicitante(solicitanteId: number): Promise<MensajeChatDto[]> {
  return request<MensajeChatDto[]>(`/chat/${solicitanteId}`)
}

export function enviarComoSecretaria(solicitanteId: number, texto: string): Promise<MensajeChatDto> {
  return request<MensajeChatDto>(`/chat/${solicitanteId}`, { method: 'POST', body: { texto } })
}
