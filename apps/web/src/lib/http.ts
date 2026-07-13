// Sin VITE_API_URL explícito: en dev (`vite dev`) apunta al backend local en
// 8002 (flujo de dos servidores separados); en un build de producción
// (`vite build`) asume mismo origen que la API (deploy de un solo web
// service, ej. Render) — así no depende de poder fijar esa env var ahí.
const BASE_URL = (
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8002' : '')
).replace(/\/$/, '')

const TOKEN_KEY = 'ce_auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
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
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
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
    // Algunos endpoints de negocio (ej. POST /expedientes/:id/enviar) devuelven
    // {mensaje, faltantes[]} en vez del formato nativo de Nest.
    if (typeof data?.mensaje === 'string') {
      const faltantes = Array.isArray(data?.faltantes) ? data.faltantes as string[] : []
      return faltantes.length > 0 ? `${data.mensaje} ${faltantes.join(', ')}` : data.mensaje
    }
  } catch {
    // respuesta sin JSON, se usa el mensaje genérico
  }
  return `Error inesperado (${res.status})`
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
    onUnauthorized?.()
    throw new ApiError(401, 'Tu sesión expiró, vuelve a iniciar sesión.')
  }

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res))
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function requestBlob(path: string, query?: RequestOptions['query']): Promise<Blob> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(buildUrl(path, query), { headers })
  if (!res.ok) throw new ApiError(res.status, await extractErrorMessage(res))
  return res.blob()
}

export async function requestUpload<T>(path: string, formData: FormData, query?: RequestOptions['query']): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(buildUrl(path, query), { method: 'POST', headers, body: formData })
  if (res.status === 401) {
    clearToken()
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

// GET /plantillas/:key?modo=ver|descargar — endpoint público (sin auth) que
// sirve las plantillas/guías estáticas del Comité.
export function plantillaUrl(key: string, modo: 'ver' | 'descargar' = 'ver') {
  return apiUrl(`/plantillas/${key}?modo=${modo}`)
}
