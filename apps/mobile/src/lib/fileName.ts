// Sanea un nombre de archivo para escribirlo en el filesystem del dispositivo:
// reemplaza separadores de ruta y caracteres inválidos por '_'. Sin imports
// nativos para poder testearlo de forma aislada.
export function sanitizeFileName(nombre: string): string {
  const limpio = (nombre ?? '').trim()
  if (!limpio) return 'documento'
  return limpio.replace(/[/\\?%*:|"<>]/g, '_')
}
