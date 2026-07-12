import { toDomainProyecto, toDomainUser, ESTADO_LABEL } from '../mappers'
import type { ExpedienteDto, UserDto } from '../../types/api'

describe('mappers', () => {
  it('toDomainUser mapea nombre/apellido/email a dominio', () => {
    const dto = {
      id: 1, email: 'a@uch.pe', nombre: 'Ana', apellido: 'Ruiz', rol: 'investigador',
      activo: true, especialidad: null, cargaTrabajo: null, conflictoInteres: null,
      codigoEstudiante: null, laboratorio: 'Lab A', createdAt: null, updatedAt: null,
    } as UserDto
    const u = toDomainUser(dto)
    expect(u).toMatchObject({ nombres: 'Ana', apellidos: 'Ruiz', correo: 'a@uch.pe', laboratorio: 'Lab A' })
  })

  it('toDomainProyecto usa facultad como fallback de programa y mapea autores', () => {
    const dto = {
      id: 5, codigoUnico: 'CE-001', tituloProtocolo: 'T', investigadorId: 1, facultad: 'Medicina',
      programaEstudios: null, ciclo: null, nivelPosgrado: null, estado: 'enviado',
      fechaEnvio: null, createdAt: '2026-01-01', autores: [
        { orden: 1, apellidosNombres: 'Ruiz, Ana', codigoEstudiante: null, correo: null, telefono: null, esPrincipal: true },
      ],
    } as unknown as ExpedienteDto
    const p = toDomainProyecto(dto)
    expect(p.programa).toBe('Medicina')
    expect(p.autores[0]).toMatchObject({ nombre: 'Ruiz, Ana', rol: 'Autor', codigo: '—' })
  })

  it('ESTADO_LABEL cubre los 8 estados', () => {
    expect(ESTADO_LABEL.aprobado_observaciones).toBe('Aprobado c/ observ.')
  })
})
