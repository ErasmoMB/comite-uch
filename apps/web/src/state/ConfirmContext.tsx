import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export interface ConfirmOptions {
  titulo?: string
  textoConfirmar?: string
  textoCancelar?: string
  peligroso?: boolean
}

interface ConfirmState extends ConfirmOptions {
  mensaje: string
}

type ConfirmFn = (mensaje: string, opciones?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

// Reemplaza a window.confirm(): en vez del diálogo nativo del navegador
// ("localhost dice: ..."), muestra un modal propio con el estilo de la app.
// Uso: const confirmar = useConfirm(); if (!(await confirmar('¿Seguro?'))) return
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<ConfirmState | null>(null)
  const resolverRef = useRef<((valor: boolean) => void) | null>(null)

  const confirmar = useCallback<ConfirmFn>((mensaje, opciones) => {
    setEstado({ mensaje, ...opciones })
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve
    })
  }, [])

  function responder(valor: boolean) {
    resolverRef.current?.(valor)
    resolverRef.current = null
    setEstado(null)
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {estado && (
        <div className="modal-backdrop" onClick={() => responder(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            {estado.titulo && (
              <strong style={{ fontSize: 16, display: 'block', marginBottom: 8, color: 'var(--navy)' }}>{estado.titulo}</strong>
            )}
            <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.55, color: 'var(--slate-700)' }}>{estado.mensaje}</p>
            <div className="btn-row">
              <button className="btn btn-outline" onClick={() => responder(false)}>
                {estado.textoCancelar ?? 'Cancelar'}
              </button>
              <button className={`btn ${estado.peligroso ? 'btn-danger' : 'btn-primary'}`} onClick={() => responder(true)}>
                {estado.textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return ctx
}
