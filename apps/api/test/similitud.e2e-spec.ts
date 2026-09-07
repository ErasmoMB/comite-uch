import {
  huellaAutores,
  normalizarNombreAutor,
  normalizarTexto,
  similitudTitulos,
  tipoProyectoPorCiclo,
  TIPO_PROYECTO,
  MAX_INTENTOS_REENVIO,
  ESTADOS_REENVIABLES,
  UMBRAL_SIMILITUD_TITULO_DEFAULT,
} from '@comite/shared';

// Tests PUROS (sin base de datos ni Nest): viven en `test/` porque es el
// runner que ya usa el repo para el código que importa `@comite/shared`
// compilado. Cubren las utilidades que sostienen las observaciones 1, 2 y 3
// del Comité.
describe('normalizarTexto', () => {
  it('pasa a minúsculas, quita tildes/ñ y colapsa espacios y puntuación', () => {
    expect(normalizarTexto('  Efectos  del  MINDFULNESS, 2026 ')).toBe('efectos del mindfulness 2026');
    expect(normalizarTexto('Diseño de investigación clínica')).toBe('diseno de investigacion clinica');
    expect(normalizarTexto('¿Cómo influye el estrés?')).toBe('como influye el estres');
  });

  it('devuelve cadena vacía para null/undefined/vacío', () => {
    expect(normalizarTexto(null)).toBe('');
    expect(normalizarTexto(undefined)).toBe('');
    expect(normalizarTexto('   ')).toBe('');
  });

  it('dos títulos que solo difieren en tildes, mayúsculas y espacios normalizan igual', () => {
    expect(normalizarTexto('Evaluación   NUTRICIONAL en niños')).toBe(
      normalizarTexto('evaluacion nutricional en ninos'),
    );
  });
});

describe('similitudTitulos', () => {
  it('títulos idénticos tras normalizar dan 1', () => {
    expect(similitudTitulos('Efectos del Mindfulness', 'efectos  del   mindfulness')).toBe(1);
  });

  it('un título casi igual (plural / una palabra distinta) supera el umbral por defecto', () => {
    const s = similitudTitulos(
      'Efecto del mindfulness en la ansiedad de estudiantes de enfermería',
      'Efectos del mindfulness en la ansiedad de estudiantes de enfermería',
    );
    expect(s).toBeGreaterThanOrEqual(UMBRAL_SIMILITUD_TITULO_DEFAULT);
    expect(s).toBeLessThan(1);
  });

  it('títulos de temas distintos quedan muy por debajo del umbral', () => {
    const s = similitudTitulos(
      'Efectos del mindfulness en la ansiedad de estudiantes',
      'Prevalencia de anemia en gestantes del distrito de Comas',
    );
    expect(s).toBeLessThan(UMBRAL_SIMILITUD_TITULO_DEFAULT);
  });

  it('siempre devuelve un valor dentro de [0, 1]', () => {
    for (const [a, b] of [
      ['abc', 'xyz'],
      ['', 'algo'],
      ['algo', ''],
      ['largo titulo de investigacion', 'l'],
    ]) {
      const s = similitudTitulos(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('huellaAutores', () => {
  it('no depende del orden en que se cargaron los autores', () => {
    const a = huellaAutores([{ apellidosNombres: 'Pérez Gómez, Juan' }, { apellidosNombres: 'Ríos, Ana' }]);
    const b = huellaAutores([{ apellidosNombres: 'ríos ana' }, { apellidosNombres: 'perez gomez juan' }]);
    expect(a).toBe(b);
  });

  it('ignora autores vacíos y repetidos', () => {
    expect(huellaAutores([{ apellidosNombres: 'Ana' }, { apellidosNombres: 'ANA' }, { apellidosNombres: '' }])).toBe(
      'ana',
    );
  });

  it('lista vacía da huella vacía', () => {
    expect(huellaAutores([])).toBe('');
    expect(huellaAutores(null)).toBe('');
  });

  it('normalizarNombreAutor usa la misma normalización que el título', () => {
    expect(normalizarNombreAutor('Pérez  Gómez, Juan')).toBe(normalizarTexto('Perez Gomez Juan'));
  });
});

describe('tipoProyectoPorCiclo (observación 1)', () => {
  it('ciclo VII preselecciona ARTICULO y ciclo IX preselecciona TESIS', () => {
    expect(tipoProyectoPorCiclo('VII')).toBe(TIPO_PROYECTO.ARTICULO);
    expect(tipoProyectoPorCiclo('IX')).toBe(TIPO_PROYECTO.TESIS);
  });

  it('ciclos VIII y X no preseleccionan nada (criterio pendiente del Comité)', () => {
    expect(tipoProyectoPorCiclo('VIII')).toBeNull();
    expect(tipoProyectoPorCiclo('X')).toBeNull();
  });

  it('sin ciclo (rol interno / posgrado) no preselecciona nada', () => {
    expect(tipoProyectoPorCiclo(null)).toBeNull();
    expect(tipoProyectoPorCiclo(undefined)).toBeNull();
    expect(tipoProyectoPorCiclo('')).toBeNull();
  });
});

describe('constantes de reenvío (observación 4)', () => {
  it('el tope de intentos es 3', () => {
    expect(MAX_INTENTOS_REENVIO).toBe(3);
  });

  it('solo no_aprobado y subsanacion son reenviables (aprobado_observaciones no)', () => {
    expect(ESTADOS_REENVIABLES).toContain('no_aprobado');
    expect(ESTADOS_REENVIABLES).toContain('subsanacion');
    expect(ESTADOS_REENVIABLES).not.toContain('aprobado_observaciones');
  });
});
