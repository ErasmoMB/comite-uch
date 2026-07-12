export function formatearFecha(fecha: string | null | undefined, vacio = 'sin fecha'): string {
  if (!fecha) return vacio
  const d = new Date(fecha)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${d.getFullYear()}`
}

export function formatearFechaHora(fecha: string | null | undefined, vacio = '—'): string {
  if (!fecha) return vacio
  const d = new Date(fecha)
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return `${formatearFecha(fecha)}, ${hora}`
}

export function fechaLocalISO(fecha: string): string {
  const d = new Date(fecha)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}
