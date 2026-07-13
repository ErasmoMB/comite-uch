// src/lib/__tests__/chartBars.test.ts
import { anchoBarra, maximoValor, porcentajeSegmento, totalValores } from '../chartBars'

describe('chartBars', () => {
  it('anchoBarra escala contra el máximo con piso de 2%', () => {
    expect(anchoBarra(10, 10)).toBe(100)
    expect(anchoBarra(5, 10)).toBe(50)
    expect(anchoBarra(1, 100)).toBe(2) // round(1) = 1 -> piso 2
    expect(anchoBarra(0, 5)).toBe(2)   // valor 0 -> piso 2
  })
  it('maximoValor nunca baja de 1 (evita división por 0)', () => {
    expect(maximoValor([1, 4, 2])).toBe(4)
    expect(maximoValor([])).toBe(1)
    expect(maximoValor([0, 0])).toBe(1)
  })
  it('porcentajeSegmento es la proporción del total; 0 si total <= 0', () => {
    expect(porcentajeSegmento(1, 4)).toBe(25)
    expect(porcentajeSegmento(3, 4)).toBe(75)
    expect(porcentajeSegmento(2, 0)).toBe(0)
  })
  it('totalValores suma la lista', () => {
    expect(totalValores([1, 2, 3])).toBe(6)
    expect(totalValores([])).toBe(0)
  })
})
