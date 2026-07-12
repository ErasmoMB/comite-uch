// src/state/ConfirmContext.tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../lib/theme'
import { Button } from '../components/ui'

export interface ConfirmOptions {
  titulo?: string
  textoConfirmar?: string
  textoCancelar?: string
  peligroso?: boolean
}
interface ConfirmState extends ConfirmOptions { mensaje: string }
type ConfirmFn = (mensaje: string, opciones?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<ConfirmState | null>(null)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirmar = useCallback<ConfirmFn>((mensaje, opciones) => {
    setEstado({ mensaje, ...opciones })
    return new Promise<boolean>(resolve => { resolverRef.current = resolve })
  }, [])

  function responder(valor: boolean) {
    resolverRef.current?.(valor)
    resolverRef.current = null
    setEstado(null)
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Modal visible={!!estado} transparent animationType="fade" onRequestClose={() => responder(false)}>
        <Pressable style={s.backdrop} onPress={() => responder(false)}>
          <Pressable style={s.card} onPress={() => {}}>
            {estado?.titulo && <Text style={s.titulo}>{estado.titulo}</Text>}
            <Text style={s.mensaje}>{estado?.mensaje}</Text>
            <View style={s.row}>
              <Button title={estado?.textoCancelar ?? 'Cancelar'} variant="outline" style={{ flex: 1 }} onPress={() => responder(false)} />
              <Button title={estado?.textoConfirmar ?? 'Confirmar'} variant={estado?.peligroso ? 'danger' : 'primary'} style={{ flex: 1 }} onPress={() => responder(true)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return ctx
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,32,74,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 8 },
  titulo: { fontSize: 16, fontWeight: '700', color: colors.navy },
  mensaje: { fontSize: 14, lineHeight: 20, color: colors.slate700, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
})
