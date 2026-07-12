// src/lib/__tests__/roles.test.ts
import { homeGroupForRole } from '../roles'

describe('homeGroupForRole', () => {
  it('manda los 3 sub-roles solicitante a /(app)', () => {
    expect(homeGroupForRole('estudiante_pregrado')).toBe('/(app)')
    expect(homeGroupForRole('estudiante_postgrado')).toBe('/(app)')
    expect(homeGroupForRole('investigador')).toBe('/(app)')
  })
  it('manda secretaría a /(secretaria)', () => {
    expect(homeGroupForRole('secretaria')).toBe('/(secretaria)')
  })
  it('roles internos aún no implementados van a la pantalla de rol no disponible, NO a /(app)', () => {
    expect(homeGroupForRole('coordinador')).toBe('/rol-no-disponible')
    expect(homeGroupForRole('evaluador')).toBe('/rol-no-disponible')
    expect(homeGroupForRole('administrador')).toBe('/rol-no-disponible')
  })
})
