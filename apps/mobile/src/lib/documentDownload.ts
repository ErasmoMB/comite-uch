// SDK 54: la API de downloadAsync/cacheDirectory con header Authorization vive
// en el submódulo legacy (la API nueva por defecto usa clases File/Directory).
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { getToken } from './http'
import { sanitizeFileName } from './fileName'

// Descarga un documento autenticado (token Bearer) a almacenamiento temporal
// del dispositivo y abre el selector nativo "Abrir con…" (share sheet de
// Android) para que el usuario lo vea con su app instalada (visor PDF, galería,
// Drive, etc.). Sustituye al visor embebido de la web, no disponible en RN.
//
// `url` debe ser una URL absoluta (el caller la construye con apiUrl(...)).
export async function abrirDocumento(url: string, nombreArchivo: string): Promise<void> {
  const token = await getToken()
  const destino = `${FileSystem.cacheDirectory}${sanitizeFileName(nombreArchivo)}`

  const { status, uri } = await FileSystem.downloadAsync(url, destino, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (status !== 200) {
    throw new Error(`No se pudo descargar el documento (código ${status}).`)
  }

  const disponible = await Sharing.isAvailableAsync()
  if (!disponible) {
    throw new Error('Abrir/compartir archivos no está disponible en este dispositivo.')
  }

  await Sharing.shareAsync(uri)
}
