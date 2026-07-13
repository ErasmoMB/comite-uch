import { ordenarPorCarga, pendientesPorEvaluador } from '../evaluadorCarga'
import type { EvaluacionDto, UserDto } from '../../types/api'

function ev(over: Partial<EvaluacionDto>): EvaluacionDto {
  return {
    id: 1, expedienteId: 1, evaluadorId: 1, recommendation: null, observaciones: null,
    completa: false, conflictoInteres: false, fechaAsignacion: null, fechaEnvio: null,
    puntajeTotal: null, resultado: null, rubricaPdfPath: null, dictamenPdfPath: null,
    ...over,
  } as EvaluacionDto
}
function user(over: Partial<UserDto>): UserDto {
  return {
    id: 1, email: 'e@x.com', nombre: 'N', apellido: 'A', rol: 'evaluador', activo: true,
    especialidad: null, cargaTrabajo: null, conflictoInteres: null, codigoEstudiante: null,
    laboratorio: null, createdAt: null, updatedAt: null,
    ...over,
  } as UserDto
}

describe('pendientesPorEvaluador', () => {
  it('cuenta solo las evaluaciones sin completar, agrupadas por evaluador', () => {
    const p = pendientesPorEvaluador([
      ev({ id: 1, evaluadorId: 10, completa: false }),
      ev({ id: 2, evaluadorId: 10, completa: false }),
      ev({ id: 3, evaluadorId: 10, completa: true }),
      ev({ id: 4, evaluadorId: 20, completa: false }),
    ])
    expect(p).toEqual({ 10: 2, 20: 1 })
  })
  it('no incluye a un evaluador cuyas evaluaciones están todas completas', () => {
    const p = pendientesPorEvaluador([ev({ evaluadorId: 5, completa: true })])
    expect(p[5]).toBeUndefined()
  })
})

describe('ordenarPorCarga', () => {
  it('ordena de menor a mayor carga pendiente', () => {
    const a = user({ id: 1 }), b = user({ id: 2 }), c = user({ id: 3 })
    const r = ordenarPorCarga([a, b, c], { 1: 3, 2: 0, 3: 1 })
    expect(r.map(u => u.id)).toEqual([2, 3, 1])
  })
  it('trata la carga ausente como 0', () => {
    const a = user({ id: 1 }), b = user({ id: 2 })
    const r = ordenarPorCarga([a, b], { 1: 2 })
    expect(r.map(u => u.id)).toEqual([2, 1])
  })
})
