// Formato aceptado y peso máximo por tipo de documento. Igual que en el
// frontend de referencia: el backend NO expone esto en /expedientes/catalogos
// (solo tipo/label/indicaciones/plantilla), así que es un catálogo de UI
// replicado aquí, indexado por el mismo `tipo` que sí da el backend.
export const MAX_SIZE_MB = 10
export const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const PDF_MIMES = ['application/pdf']
const WORD_MIMES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export interface DocumentFormat {
  label: string
  extensions: string[]
  mimeTypes: string[]
}

export const DOCUMENT_FORMATS: Record<string, DocumentFormat> = {
  proyecto_pdf: { label: 'PDF', extensions: ['.pdf'], mimeTypes: PDF_MIMES },
  proyecto_word: { label: 'Word (.doc, .docx)', extensions: ['.doc', '.docx'], mimeTypes: WORD_MIMES },
  solicitud_evaluacion: { label: 'PDF', extensions: ['.pdf'], mimeTypes: PDF_MIMES },
  carta_aprobacion: { label: 'PDF', extensions: ['.pdf'], mimeTypes: PDF_MIMES },
  boleta_pago: {
    label: 'PDF o imagen (JPG/PNG)',
    extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
    mimeTypes: [...PDF_MIMES, ...IMAGE_MIMES],
  },
  solicitud_cambio_titulo: { label: 'PDF', extensions: ['.pdf'], mimeTypes: PDF_MIMES },
}

const FORMATO_GENERICO: DocumentFormat = {
  label: 'PDF / Word',
  extensions: ['.pdf', '.doc', '.docx'],
  mimeTypes: [...PDF_MIMES, ...WORD_MIMES],
}

export function formatoDocumento(tipo: string): DocumentFormat {
  return DOCUMENT_FORMATS[tipo] ?? FORMATO_GENERICO
}

export function validarDocumento(file: File, tipo: string): string | null {
  const formato = formatoDocumento(tipo)
  const nombre = file.name.toLowerCase()
  const extensionValida = formato.extensions.some(ext => nombre.endsWith(ext))
  if (!extensionValida) {
    return `Formato no válido. Se espera: ${formato.label}.`
  }
  if (file.type && !formato.mimeTypes.includes(file.type)) {
    return `Formato no válido. Se espera: ${formato.label}.`
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `El archivo supera el tamaño máximo de ${MAX_SIZE_MB} MB.`
  }
  return null
}
