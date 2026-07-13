import { fireEvent, render } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import Revision from '../[id]'
import { expedientesService } from '../../../../src/services'
import type { ExpedienteDto } from '../../../../src/types/api'

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}))

jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

jest.mock('../../../../src/services', () => ({
  expedientesService: { getDetalle: jest.fn(), update: jest.fn() },
}))

jest.mock('../../../../src/state/ConfirmContext', () => ({
  useConfirm: () => jest.fn().mockResolvedValue(true),
}))

function exp(over: Partial<ExpedienteDto>): ExpedienteDto {
  return {
    id: 1, codigoUnico: null, tituloProtocolo: 'T', investigadorId: 1, investigadorNombre: null,
    tipoTramite: null, facultad: null, modalidad: null, programaEstudios: null, ciclo: null,
    nivelPosgrado: null, numeroActa: null, tituloAnterior: null, tituloNuevo: null,
    proyectoOrigenId: null, estado: 'enviado', fechaEnvio: null, createdAt: null, updatedAt: null,
    autores: [],
    ...over,
  } as ExpedienteDto
}

const PLACEHOLDER = 'Describe qué debe corregir o completar el investigador…'

describe('Revision (secretaría)', () => {
  it('limpia el campo de observaciones al cambiar de expediente', async () => {
    const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock
    const mockGetDetalle = expedientesService.getDetalle as jest.Mock
    mockUseLocalSearchParams.mockReturnValue({ id: '1' })
    mockGetDetalle.mockImplementation((id: number) => Promise.resolve({
      expediente: exp({ id, tituloProtocolo: `Expediente ${id}` }),
      bitacora: [], historial: [], documentos: [],
    }))

    const { getByPlaceholderText, findByText, rerender } = render(<Revision />)

    await findByText('Expediente 1')
    const textarea = getByPlaceholderText(PLACEHOLDER)
    fireEvent.changeText(textarea, 'Falta la carta de consentimiento')
    expect(textarea.props.value).toBe('Falta la carta de consentimiento')

    mockUseLocalSearchParams.mockReturnValue({ id: '2' })
    rerender(<Revision />)

    await findByText('Expediente 2')
    expect(getByPlaceholderText(PLACEHOLDER).props.value).toBe('')
  })
})
