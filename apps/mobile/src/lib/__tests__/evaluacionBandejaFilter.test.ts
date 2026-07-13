// src/lib/__tests__/evaluacionBandejaFilter.test.ts
import { filtrarEvaluacionesAsignadas, type FilaEvaluacion } from '../evaluacionBandejaFilter'
import type { ExpedienteDto } from '../../types/api'
import type { MiEvaluacionDto } from '../../services/evaluacion.service'

function exp(over: Partial<ExpedienteDto>): ExpedienteDto {
  return {
    id: 1, codigoUnico: null, tituloProtocolo: 'T', investigadorId: 1, investigadorNombre: null,
    tipoTramite: null, facultad: null, modalidad: null, programaEstudios: null, ciclo: null,
    nivelPosgrado: null, numeroActa: null, tituloAnterior: null, tituloNuevo: null,
    proyectoOrigenId: null, estado: 'en_revision', fechaEnvio: null, createdAt: null, updatedAt: null,
    ...over,
  } as ExpedienteDto
}
function ev(id: number, expedienteId: number): MiEvaluacionDto {
  return {
    id, expedienteId, evaluadorId: 1, recommendation: null, observaciones: null, completa: false,
    conflictoInteres: false, tituloProtocolo: null, investigadorNombre: null, expedienteFechaEnvio: null,
    criterios: [], puntajeTotal: null, resultado: null, rubricaPdfUrl: null, dictamenPdfUrl: null, createdAt: null,
  }
}
function fila(evId: number, expOver: Partial<ExpedienteDto> | null): FilaEvaluacion {
  const expedienteId = expOver?.id ?? evId * 10
  return { evaluacion: ev(evId, expedienteId), expediente: expOver ? exp({ id: expedienteId, ...expOver }) : null }
}

describe('filtrarEvaluacionesAsignadas', () => {
  const base: FilaEvaluacion[] = [
    fila(1, { id: 11, tituloProtocolo: 'Alpha', codigoUnico: 'A-1', fechaEnvio: '2026-07-01T10:00:00' }),
    fila(2, { id: 12, tituloProtocolo: 'Beta', codigoUnico: 'B-2', fechaEnvio: '2026-07-05T10:00:00' }),
  ]

  it('ordena por fechaEnvio descendente (más reciente primero)', () => {
    const r = filtrarEvaluacionesAsignadas(base, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(r.map(f => f.evaluacion.id)).toEqual([2, 1])
  })
  it('filtra por texto en título del expediente', () => {
    const r = filtrarEvaluacionesAsignadas(base, { busqueda: 'alpha', fechaDesde: '', fechaHasta: '' })
    expect(r.map(f => f.evaluacion.id)).toEqual([1])
  })
  it('filtra por rango de fechas (desde/hasta inclusivo)', () => {
    const r = filtrarEvaluacionesAsignadas(base, { busqueda: '', fechaDesde: '2026-07-05', fechaHasta: '2026-07-05' })
    expect(r.map(f => f.evaluacion.id)).toEqual([2])
  })
  it('anexa filas sin expediente al final SOLO cuando no hay filtros activos', () => {
    const conNull = [...base, fila(3, null)]
    const sinFiltro = filtrarEvaluacionesAsignadas(conNull, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(sinFiltro.map(f => f.evaluacion.id)).toEqual([2, 1, 3])
    const conFiltro = filtrarEvaluacionesAsignadas(conNull, { busqueda: 'beta', fechaDesde: '', fechaHasta: '' })
    expect(conFiltro.map(f => f.evaluacion.id)).toEqual([2])
  })
})
