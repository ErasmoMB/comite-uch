import { puntajeAcumulado, resultadoPrevisto } from '../rubricaResultado'
import type { RubricaDto } from '../../types/api'

const rubrica: RubricaDto = {
  criterios: [
    { key: 'a', nombre: 'A', descripcion: '', puntajeMax: 10 },
    { key: 'b', nombre: 'B', descripcion: '', puntajeMax: 10 },
  ],
  puntajeTotalMax: 20,
  umbrales: { aprobado: '17-20', aprobado_observaciones: '13-16', no_aprobado: '0-12' },
}

describe('puntajeAcumulado', () => {
  it('suma los puntajes numéricos por criterio', () => {
    expect(puntajeAcumulado(rubrica, { a: '7', b: '9' })).toBe(16)
  })
  it('trata vacío / no numérico / ausente como 0', () => {
    expect(puntajeAcumulado(rubrica, { a: '', b: 'x' })).toBe(0)
    expect(puntajeAcumulado(rubrica, { a: '5' })).toBe(5)
  })
})

describe('resultadoPrevisto (umbrales 17-20 / 13-16 / 0-12)', () => {
  it('>= 17 -> aprobado', () => {
    expect(resultadoPrevisto(rubrica, 17)).toBe('aprobado')
    expect(resultadoPrevisto(rubrica, 20)).toBe('aprobado')
  })
  it('13..16 -> aprobado_observaciones', () => {
    expect(resultadoPrevisto(rubrica, 13)).toBe('aprobado_observaciones')
    expect(resultadoPrevisto(rubrica, 16)).toBe('aprobado_observaciones')
  })
  it('<= 12 -> no_aprobado', () => {
    expect(resultadoPrevisto(rubrica, 12)).toBe('no_aprobado')
    expect(resultadoPrevisto(rubrica, 0)).toBe('no_aprobado')
  })
})
