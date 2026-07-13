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
  it('manda coordinador a /(coordinador)', () => {
    expect(homeGroupForRole('coordinador')).toBe('/(coordinador)')
  })
  it('manda evaluador a /(evaluador)', () => {
    expect(homeGroupForRole('evaluador')).toBe('/(evaluador)')
  })
  it('manda administrador a su propio grupo /(administrador) (ya no al fallback)', () => {
    expect(homeGroupForRole('administrador')).toBe('/(administrador)')
  })
})
