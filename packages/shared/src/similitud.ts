// Utilidades de comparación de títulos de expedientes.
//
// Sirven a dos observaciones distintas del Comité:
//   - Observación 2: alertar a Secretaría cuando un título nuevo se PARECE
//     mucho a uno ya ingresado (`similitudTitulos` + umbral configurable).
//   - Observación 3: rechazar automáticamente cuando el expediente es
//     EXACTAMENTE el mismo (`normalizarTexto` sobre título, autores, ciclo y
//     facultad/programa).
//
// A propósito no se usa ninguna dependencia externa: son unas pocas decenas
// de líneas, deben poder explicarse al Comité, y el volumen de expedientes
// activos es de decenas/centenas, no de millones.

// Minúsculas, sin tildes/diéresis, sin signos de puntuación y con los
// espacios múltiples colapsados. "  Efectos  del  MINDFULNESS, 2026 " ->
// "efectos del mindfulness 2026".
export function normalizarTexto(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .normalize('NFD')
    // Marcas diacríticas combinantes (U+0300–U+036F): quita la tilde pero
    // deja la letra base. La "ñ" se descompone en "n" + tilde, así que
    // también se normaliza a "n" (deseado: "diseño" == "diseno").
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Los nombres de autores se comparan con la misma normalización que el
// título: "Pérez Gómez, Juan Carlos" y "perez gomez juan carlos" son la
// misma persona para efectos de detectar un expediente duplicado.
export function normalizarNombreAutor(nombre: string | null | undefined): string {
  return normalizarTexto(nombre)
}

// Distancia de edición de Levenshtein entre dos cadenas ya normalizadas.
// Implementación por filas (O(min(n,m)) de memoria) — los títulos son cortos,
// pero esto se ejecuta contra todos los expedientes activos en cada envío.
function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let anterior = new Array<number>(b.length + 1)
  let actual = new Array<number>(b.length + 1)

  for (let j = 0; j <= b.length; j++) anterior[j] = j

  for (let i = 1; i <= a.length; i++) {
    actual[0] = i
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      actual[j] = Math.min(
        actual[j - 1] + 1, // inserción
        anterior[j] + 1, // borrado
        anterior[j - 1] + costo, // sustitución
      )
    }
    const tmp = anterior
    anterior = actual
    actual = tmp
  }
  return anterior[b.length]
}

/**
 * Similitud entre dos títulos, en el rango [0, 1]:
 * `1 - distanciaLevenshtein / longitudDelMasLargo` sobre los títulos ya
 * normalizados. 1 = idénticos tras normalizar; 0 = nada en común.
 *
 * Se eligió Levenshtein normalizado (en vez de Jaccard sobre tokens) porque
 * el caso que preocupa al Comité es el "mismo proyecto reescrito apenas":
 * plurales, una palabra cambiada o una preposición distinta siguen dando una
 * similitud alta, mientras que Jaccard trataría "efecto" y "efectos" como
 * dos tokens sin relación.
 */
export function similitudTitulos(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizarTexto(a)
  const nb = normalizarTexto(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  return 1 - distanciaLevenshtein(na, nb) / maxLen
}

/**
 * Huella de los autores de un expediente, para la comparación de duplicado
 * EXACTO: conjunto (sin repetidos) de nombres normalizados, ordenado
 * alfabéticamente y unido con "|". El orden en que se cargaron los autores
 * no debe cambiar el resultado.
 */
export function huellaAutores(autores: { apellidosNombres?: string | null }[] | null | undefined): string {
  if (!autores || autores.length === 0) return ''
  const nombres = autores
    .map((a) => normalizarNombreAutor(a.apellidosNombres))
    .filter((n) => n.length > 0)
  return Array.from(new Set(nombres)).sort().join('|')
}
