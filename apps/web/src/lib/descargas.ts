import { ApiError, getToken } from './http'

// Descarga autenticada vía blob: un <a href> directo al backend NO llevaría el
// header Authorization (el navegador no lo agrega en una navegación simple),
// así que se resuelve con fetch + Authorization Bearer + Blob URL temporal,
// igual que expedientesService.descargarDocumento.
export async function descargarArchivo(url: string, nombreArchivo: string): Promise<void> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new ApiError(res.status, 'No se pudo descargar el archivo.')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

// El dictamen SOLO se genera cuando el proyecto queda aprobado (con o sin
// observaciones); la rúbrica SOLO cuando hay algo que corregir (observaciones
// o no aprobado). Ver EvaluacionService.generarPdfsPostEnvio en el backend:
//   aprobado               -> dictamen
//   aprobado_observaciones -> rúbrica + dictamen
//   no_aprobado            -> rúbrica
export function hayDictamen(resultado: string | null | undefined): boolean {
  return resultado === 'aprobado' || resultado === 'aprobado_observaciones'
}

export function hayRubrica(resultado: string | null | undefined): boolean {
  return resultado === 'aprobado_observaciones' || resultado === 'no_aprobado'
}

export const RESULTADO_LABEL: Record<string, string> = {
  aprobado: 'Aprobado',
  aprobado_observaciones: 'Aprobado con observaciones',
  no_aprobado: 'No aprobado',
}
