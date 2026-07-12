import { render } from '@testing-library/react-native'
import { StatusBadge, Button } from '../ui'

describe('ui', () => {
  it('StatusBadge muestra la etiqueta del estado', () => {
    const { getByText } = render(<StatusBadge estado="subsanacion" />)
    expect(getByText('Subsanación')).toBeTruthy()
  })
  it('Button muestra su título', () => {
    const { getByText } = render(<Button title="Ingresar" />)
    expect(getByText('Ingresar')).toBeTruthy()
  })
})
