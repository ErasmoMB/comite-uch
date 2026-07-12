import { sanitizeFileName } from '../fileName'

describe('sanitizeFileName', () => {
  it('reemplaza separadores de ruta y caracteres inválidos por guion bajo', () => {
    expect(sanitizeFileName('a/b\\c:d?e*f.pdf')).toBe('a_b_c_d_e_f.pdf')
  })
  it('conserva un nombre válido tal cual', () => {
    expect(sanitizeFileName('proyecto_final.pdf')).toBe('proyecto_final.pdf')
  })
  it('usa un nombre por defecto cuando viene vacío o solo espacios', () => {
    expect(sanitizeFileName('')).toBe('documento')
    expect(sanitizeFileName('   ')).toBe('documento')
  })
})
