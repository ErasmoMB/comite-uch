import { CRITERIOS_RUBRICA } from '@comite/shared';
import {
  normalizarSugerencias,
  PUNTAJES_MAXIMOS,
  type RespuestaRubrica,
} from '../src/ia/rubrica.prompt';

/**
 * El esquema con `enum` que se le manda a Gemini reduce las desviaciones pero
 * no las elimina: un modelo puede omitir un criterio, inventar una clave o
 * excederse en el puntaje. Nada de eso debe romper el cálculo del total ni
 * dejar la rúbrica a medias, así que se normaliza del lado del servidor.
 *
 * Estas pruebas no llaman a la API: validan solo esa normalización.
 */
describe('normalizarSugerencias', () => {
  const completa = (): RespuestaRubrica => ({
    criterios: CRITERIOS_RUBRICA.map((c) => ({
      key: c.key as string,
      puntaje: c.puntajeMax as number,
      justificacion: `Justificación de ${c.key}`,
      cita: 'Sección 1',
    })),
  });

  it('devuelve siempre los 7 criterios, en el orden del catálogo', () => {
    // Se invierte el orden a propósito: el resultado no debe depender del
    // orden en que responda el modelo.
    const desordenada = { criterios: [...completa().criterios].reverse() };
    const r = normalizarSugerencias(desordenada);

    expect(r).toHaveLength(CRITERIOS_RUBRICA.length);
    expect(r.map((c) => c.key)).toEqual(CRITERIOS_RUBRICA.map((c) => c.key));
  });

  it('recorta un puntaje que supera el máximo del criterio', () => {
    const bruto = completa();
    bruto.criterios[0] = { ...bruto.criterios[0], puntaje: 99 };

    const r = normalizarSugerencias(bruto);
    const max = PUNTAJES_MAXIMOS[r[0].key];
    expect(r[0].puntaje).toBe(max);
  });

  it('lleva a 0 un puntaje negativo', () => {
    const bruto = completa();
    bruto.criterios[0] = { ...bruto.criterios[0], puntaje: -5 };

    expect(normalizarSugerencias(bruto)[0].puntaje).toBe(0);
  });

  it('completa con 0 y una nota explícita el criterio que el modelo omitió', () => {
    const bruto = completa();
    const omitido = bruto.criterios[2].key;
    bruto.criterios.splice(2, 1);

    const r = normalizarSugerencias(bruto);
    const rellenado = r.find((c) => c.key === omitido)!;

    expect(r).toHaveLength(CRITERIOS_RUBRICA.length);
    expect(rellenado.puntaje).toBe(0);
    // Debe quedar claro que ahí NO hubo evaluación, no parecer un 0 evaluado.
    expect(rellenado.justificacion).toMatch(/no propuso/i);
  });

  it('descarta claves que no existen en el catálogo', () => {
    const bruto = completa();
    bruto.criterios.push({
      key: 'criterio_inventado_por_el_modelo',
      puntaje: 5,
      justificacion: 'x',
      cita: 'y',
    });

    const r = normalizarSugerencias(bruto);
    expect(r).toHaveLength(CRITERIOS_RUBRICA.length);
    expect(r.some((c) => c.key === 'criterio_inventado_por_el_modelo')).toBe(false);
  });

  it('redondea un puntaje decimal', () => {
    const bruto = completa();
    bruto.criterios[1] = { ...bruto.criterios[1], puntaje: 2.6 };

    expect(normalizarSugerencias(bruto)[1].puntaje).toBe(3);
  });

  it('sustituye por 0 un puntaje que no es un número', () => {
    const bruto = completa();
    bruto.criterios[0] = { ...bruto.criterios[0], puntaje: 'tres' as unknown as number };

    expect(normalizarSugerencias(bruto)[0].puntaje).toBe(0);
  });

  it('pone un texto por defecto cuando falta la justificación o la cita', () => {
    const bruto = completa();
    bruto.criterios[0] = { ...bruto.criterios[0], justificacion: '   ', cita: '' };

    const r = normalizarSugerencias(bruto)[0];
    expect(r.justificacion.length).toBeGreaterThan(0);
    expect(r.cita).toBe('No consta en el documento');
  });

  it('no revienta si el modelo no devuelve nada usable', () => {
    for (const entrada of [null, undefined, { criterios: [] }]) {
      const r = normalizarSugerencias(entrada as never);
      expect(r).toHaveLength(CRITERIOS_RUBRICA.length);
      expect(r.every((c) => c.puntaje === 0)).toBe(true);
    }
  });
});
