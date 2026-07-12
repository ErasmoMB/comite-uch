import {
  CRITERIOS_RUBRICA as SHARED_CRITERIOS_RUBRICA,
  PUNTAJE_TOTAL_MAX as SHARED_PUNTAJE_TOTAL_MAX,
  CRITERIOS_MAX_POR_KEY as SHARED_CRITERIOS_MAX_POR_KEY,
  resultadoPorPuntaje as sharedResultadoPorPuntaje,
} from '@comite/shared';
export type { CriterioRubrica, ResultadoEvaluacion } from '@comite/shared';

export const CRITERIOS_RUBRICA = SHARED_CRITERIOS_RUBRICA;
export const PUNTAJE_TOTAL_MAX = SHARED_PUNTAJE_TOTAL_MAX;
export const CRITERIOS_MAX_POR_KEY = SHARED_CRITERIOS_MAX_POR_KEY;
export const resultadoPorPuntaje = sharedResultadoPorPuntaje;
