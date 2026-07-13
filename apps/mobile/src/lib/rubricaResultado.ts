// src/lib/rubricaResultado.ts
import type { RubricaDto } from '../types/api'

export type ResultadoRubrica = 'aprobado' | 'aprobado_observaciones' | 'no_aprobado'

// Puntaje acumulado a partir del estado local del formulario (puntajes como
// string por criterio, indexados por c.key). Vacío / no numérico cuenta 0 --
// igual que la web (Number(...) || 0).
export function puntajeAcumulado(rubrica: RubricaDto, puntajes: Record<string, string>): number {
  return rubrica.criterios.reduce((acc, c) => acc + (Number(puntajes[c.key]) || 0), 0)
}

// Resultado previsto comparando el total contra el límite inferior de cada
// umbral ('17-20' -> 17, '13-16' -> 13). Mismo criterio que la web
// (evaluador/Evaluacion.tsx: se compara contra Number(rango.split('-')[0])).
export function resultadoPrevisto(rubrica: RubricaDto, total: number): ResultadoRubrica {
  const limiteInferior = (rango: string) => Number(rango.split('-')[0])
  if (total >= limiteInferior(rubrica.umbrales.aprobado)) return 'aprobado'
  if (total >= limiteInferior(rubrica.umbrales.aprobado_observaciones)) return 'aprobado_observaciones'
  return 'no_aprobado'
}
