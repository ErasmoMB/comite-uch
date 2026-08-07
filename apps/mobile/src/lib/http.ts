import * as SecureStore from 'expo-secure-store'

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8002').replace(/\/$/, '')

// SecureStore no permite ciertos caracteres en las keys; guion bajo es válido.
const TOKEN_KEY = 'ce_auth_token'

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// `status: 0` = nunca hubo respuesta del servidor (sin red, servidor apagado o
// timeout), a diferencia de un error HTTP real devuelto por el backend.
export const SIN_RESPUESTA = 0

export function esSinRespuesta(e: unknown): boolean {
  return e instanceof ApiError && e.status === SIN_RESPUESTA
}

const MENSAJE_SIN_RESPUESTA =
  'Servidor inactivo: no respondió a tiempo. Si acaba de encenderse puede tardar hasta un minuto; espera un momento y vuelve a intentarlo.'

// El plan free de Render apaga el servicio tras ~15 min sin tráfico y la
// petición que lo despierta tarda ~40s. Se da margen suficiente para que esa
// primera petición llegue a completarse en vez de fallar de inmediato.
const TIMEOUT_MS = 75_000

// Envuelve fetch con timeout y traduce cualquier fallo de red a un ApiError
// con mensaje entendible. Sin esto, una caída del servidor llegaba a las
// pantallas como un TypeError crudo ("Network request failed") y todas
// mostraban su texto genérico, que no le dice nada al usuario.
async function fetchConTimeout(url: string, init: RequestInit): Promise<Response> {
  const abort = new AbortController()
  const cancelar = setTimeout(() => abort.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: abort.signal })
  } catch {
    throw new ApiError(SIN_RESPUESTA, MENSAJE_SIN_RESPUESTA)
  } finally {
    clearTimeout(cancelar)
  }
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

interface RequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  auth?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${BASE_URL}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.message === 'string') return data.message
    if (Array.isArray(data?.message)) return data.message.join(', ')
    if (typeof data?.error === 'string') return data.error
    // Endpoints de negocio (ej. POST /expedientes/:id/enviar) devuelven {mensaje, faltantes[]}
    if (typeof data?.mensaje === 'string') {
      const faltantes = Array.isArray(data?.faltantes) ? (data.faltantes as string[]) : []
      return faltantes.length > 0 ? `${data.mensaje} ${faltantes.join(', ')}` : data.mensaje
    }
  } catch {
    // respuesta sin JSON
  }
  return `Error inesperado (${res.status})`
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = await getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetchConTimeout(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    await clearToken()
    onUnauthorized?.()
    throw new ApiError(401, 'Tu sesión expiró, vuelve a iniciar sesión.')
  }
  if (!res.ok) throw new ApiError(res.status, await extractErrorMessage(res))
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// Subida multipart en RN: el "file" es {uri,name,type} en vez de un Blob del DOM.
// Firma lista para cuando se integre expo-document-picker (Fase posterior).
export interface RNFile { uri: string; name: string; type: string }
export async function uploadDocumento<T>(
  path: string,
  file: RNFile,
  fields: Record<string, string> = {},
): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const formData = new FormData()
  // RN acepta este shape para multipart; TS no lo tipa, de ahí el cast.
  formData.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob)
  for (const [k, v] of Object.entries(fields)) formData.append(k, v)
  const res = await fetchConTimeout(buildUrl(path), { method: 'POST', headers, body: formData })
  if (res.status === 401) {
    await clearToken()
    onUnauthorized?.()
    throw new ApiError(401, 'Tu sesión expiró, vuelve a iniciar sesión.')
  }
  if (!res.ok) throw new ApiError(res.status, await extractErrorMessage(res))
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export function apiUrl(path: string) {
  return `${BASE_URL}${path}`
}
export function plantillaUrl(key: string, modo: 'ver' | 'descargar' = 'ver') {
  return apiUrl(`/plantillas/${key}?modo=${modo}`)
}
