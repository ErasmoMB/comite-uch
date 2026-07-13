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
  it('manda coordinador a su propio grupo /(coordinador)', () => {
    expect(homeGroupForRole('coordinador')).toBe('/(coordinador)')
  })
  it('manda evaluador a su propio grupo /(evaluador)', () => {
    expect(homeGroupForRole('evaluador')).toBe('/(evaluador)')
  })
  it('el administrador (aún no implementado) va a la pantalla de rol no disponible, NO a /(app)', () => {
    expect(homeGroupForRole('administrador')).toBe('/rol-no-disponible')
  })
})
