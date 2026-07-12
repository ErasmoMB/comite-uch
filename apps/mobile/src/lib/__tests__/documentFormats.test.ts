import { validarDocumento, MAX_SIZE_MB } from '../documentFormats'

describe('validarDocumento', () => {
  it('rechaza extensión no válida', () => {
    expect(validarDocumento({ name: 'x.txt' }, 'proyecto_pdf')).toContain('Formato no válido')
  })
  it('acepta pdf para proyecto_pdf', () => {
    expect(validarDocumento({ name: 'x.pdf', type: 'application/pdf' }, 'proyecto_pdf')).toBeNull()
  })
  it('rechaza archivo demasiado grande', () => {
    const big = (MAX_SIZE_MB + 1) * 1024 * 1024
    expect(validarDocumento({ name: 'x.pdf', type: 'application/pdf', size: big }, 'proyecto_pdf')).toContain('tamaño máximo')
  })
})
