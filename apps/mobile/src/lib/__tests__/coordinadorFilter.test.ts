import { filtrarEnRevision } from '../coordinadorFilter'
import type { ExpedienteDto } from '../../types/api'

function exp(over: Partial<ExpedienteDto>): ExpedienteDto {
  return {
    id: 1, codigoUnico: null, tituloProtocolo: 'T', investigadorId: 1, investigadorNombre: null,
    tipoTramite: null, facultad: null, modalidad: null, programaEstudios: null, ciclo: null,
    nivelPosgrado: null, numeroActa: null, tituloAnterior: null, tituloNuevo: null,
    proyectoOrigenId: null, estado: 'en_revision', fechaEnvio: null, createdAt: null, updatedAt: null,
    ...over,
  } as ExpedienteDto
}

describe('filtrarEnRevision', () => {
  const base = [
    exp({ id: 1, estado: 'en_revision', tituloProtocolo: 'Alpha', fechaEnvio: '2026-07-01T10:00:00' }),
    exp({ id: 2, estado: 'en_revision', tituloProtocolo: 'Beta', fechaEnvio: '2026-07-05T10:00:00' }),
    exp({ id: 3, estado: 'aprobado', tituloProtocolo: 'Gamma', fechaEnvio: '2026-07-03T10:00:00' }),
    exp({ id: 4, estado: 'enviado', tituloProtocolo: 'Delta', fechaEnvio: '2026-07-02T10:00:00' }),
  ]

  it('solo deja expedientes en_revision (descarta aprobado/enviado/otros)', () => {
    const r = filtrarEnRevision(base, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id).sort()).toEqual([1, 2])
  })
  it('ordena por fechaEnvio descendente', () => {
    const r = filtrarEnRevision(base, { busqueda: '', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id)).toEqual([2, 1])
  })
  it('filtra por texto en título', () => {
    const r = filtrarEnRevision(base, { busqueda: 'beta', fechaDesde: '', fechaHasta: '' })
    expect(r.map(e => e.id)).toEqual([2])
  })
  it('filtra por rango de fechas (desde/hasta inclusivo)', () => {
    const r = filtrarEnRevision(base, { busqueda: '', fechaDesde: '2026-07-01', fechaHasta: '2026-07-01' })
    expect(r.map(e => e.id)).toEqual([1])
  })
})
