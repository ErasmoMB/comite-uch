// src/lib/__tests__/usuariosFilter.test.ts
import { filtrarUsuarios } from '../usuariosFilter'
import type { UserDto } from '../../types/api'

// Solo los campos que el filtro toca importan; el resto se completa con el cast.
function u(over: Partial<UserDto>): UserDto {
  return { id: 1, email: 'ana@uch.pe', nombre: 'Ana', apellido: 'López', rol: 'coordinador', activo: true, ...over } as UserDto
}

describe('filtrarUsuarios', () => {
  const base: UserDto[] = [
    u({ id: 1, nombre: 'Ana', apellido: 'López', email: 'ana@uch.pe', rol: 'coordinador', activo: true }),
    u({ id: 2, nombre: 'Beto', apellido: 'Ruiz', email: 'beto@uch.pe', rol: 'evaluador', activo: false }),
    u({ id: 3, nombre: 'Caro', apellido: 'Díaz', email: 'caro@uch.pe', rol: 'evaluador', activo: null }),
  ]

  it('sin filtros devuelve todos', () => {
    expect(filtrarUsuarios(base, { busqueda: '', rol: 'todos', estado: 'todos' }).map(x => x.id)).toEqual([1, 2, 3])
  })
  it('filtra por texto en nombre/apellido o email (case-insensitive)', () => {
    expect(filtrarUsuarios(base, { busqueda: 'ruiz', rol: 'todos', estado: 'todos' }).map(x => x.id)).toEqual([2])
    expect(filtrarUsuarios(base, { busqueda: 'caro@', rol: 'todos', estado: 'todos' }).map(x => x.id)).toEqual([3])
  })
  it('filtra por rol', () => {
    expect(filtrarUsuarios(base, { busqueda: '', rol: 'evaluador', estado: 'todos' }).map(x => x.id)).toEqual([2, 3])
  })
  it('activos = activo !== false (incluye null); inactivos = activo === false', () => {
    expect(filtrarUsuarios(base, { busqueda: '', rol: 'todos', estado: 'activos' }).map(x => x.id)).toEqual([1, 3])
    expect(filtrarUsuarios(base, { busqueda: '', rol: 'todos', estado: 'inactivos' }).map(x => x.id)).toEqual([2])
  })
})
