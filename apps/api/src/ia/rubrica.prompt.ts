import { CRITERIOS_RUBRICA } from '@comite/shared';

/**
 * Prompt y esquema para el borrador de rúbrica, más el validador de la
 * respuesta.
 *
 * Lección de las pruebas contra la API real: si el prompt NO enumera las 7
 * claves exactas, el modelo inventa sus propias categorías. Por eso las claves
 * van tanto en el texto como en el `enum` del esquema, y además se valida al
 * recibir: el esquema es una guía para el modelo, no una garantía.
 */

export interface SugerenciaCriterio {
  key: string;
  puntaje: number;
  justificacion: string;
  cita: string;
}

export interface RespuestaRubrica {
  criterios: SugerenciaCriterio[];
}

export const ESQUEMA_RUBRICA = {
  type: 'OBJECT',
  properties: {
    criterios: {
      type: 'ARRAY',
      minItems: CRITERIOS_RUBRICA.length,
      maxItems: CRITERIOS_RUBRICA.length,
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING', enum: CRITERIOS_RUBRICA.map((c) => c.key) },
          puntaje: { type: 'INTEGER' },
          justificacion: { type: 'STRING' },
          cita: { type: 'STRING' },
        },
        required: ['key', 'puntaje', 'justificacion', 'cita'],
      },
    },
  },
  required: ['criterios'],
} as const;

export function promptRubrica(tituloProyecto: string): string {
  const lista = CRITERIOS_RUBRICA.map(
    (c) => `- ${c.key} — ${c.nombre}: ${c.descripcion} Puntaje entero de 0 a ${c.puntajeMax}.`,
  ).join('\n');

  return `Eres asistente de un comité de ética en investigación de una universidad peruana.
Estás ayudando a un evaluador humano a preparar un borrador de evaluación del
proyecto adjunto, titulado "${tituloProyecto}".

Evalúa el proyecto en CADA UNO de estos 7 criterios, sin omitir ninguno:

${lista}

Reglas que debes respetar:
- El puntaje NUNCA puede superar el máximo indicado para ese criterio.
- "cita" debe señalar la sección, capítulo o página del documento que sustenta
  el puntaje. Si el documento no dice nada al respecto, escribe exactamente
  "No consta en el documento" y asigna el puntaje que corresponda a esa ausencia.
- NO inventes contenido que no esté en el documento. Que algo falte es
  información valiosa para el comité: señálalo.
- "justificacion" debe ser concreta y breve (2 o 3 frases), en español, dirigida
  a un evaluador que va a revisar tu propuesta y decidir por sí mismo.
- Para "poblaciones_vulnerables": si el estudio no involucra población
  vulnerable, el puntaje es 0 y debes indicarlo en la justificación.`;
}

export const PUNTAJES_MAXIMOS: Record<string, number> = Object.fromEntries(
  CRITERIOS_RUBRICA.map((c) => [c.key, c.puntajeMax]),
);

/**
 * Normaliza lo que devolvió el modelo. El esquema con `enum` reduce las
 * desviaciones pero no las elimina: un modelo puede omitir un criterio o
 * excederse en el puntaje, y eso NO debe romper el cálculo del total ni dejar
 * la rúbrica a medias.
 *
 * - Cada criterio faltante se completa con puntaje 0 y una nota explícita.
 * - Los puntajes fuera de rango se recortan al máximo del criterio.
 * - Las claves desconocidas se descartan.
 * - El resultado sale SIEMPRE en el orden del catálogo, no en el del modelo.
 */
export function normalizarSugerencias(bruto: RespuestaRubrica | null | undefined): SugerenciaCriterio[] {
  const porKey = new Map<string, SugerenciaCriterio>();
  for (const c of bruto?.criterios ?? []) {
    if (typeof c?.key === 'string' && c.key in PUNTAJES_MAXIMOS) porKey.set(c.key, c);
  }

  return CRITERIOS_RUBRICA.map((criterio) => {
    const max = criterio.puntajeMax;
    const sugerida = porKey.get(criterio.key);

    if (!sugerida) {
      return {
        key: criterio.key,
        puntaje: 0,
        justificacion: 'El asistente no propuso una evaluación para este criterio. Revísalo manualmente.',
        cita: 'No consta en el documento',
      };
    }

    const bruto = Number(sugerida.puntaje);
    const puntaje = Number.isFinite(bruto) ? Math.min(Math.max(Math.round(bruto), 0), max) : 0;

    return {
      key: criterio.key,
      puntaje,
      justificacion: String(sugerida.justificacion ?? '').trim() || 'Sin justificación.',
      cita: String(sugerida.cita ?? '').trim() || 'No consta en el documento',
    };
  });
}
