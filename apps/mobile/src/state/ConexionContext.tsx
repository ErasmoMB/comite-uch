import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { apiUrl } from '../lib/http'

// Estado del backend, consultado contra GET /health (público, sin token).
//
// Por qué existe: en el plan free de Render el servicio se apaga tras ~15 min
// sin tráfico, y la primera petición lo despierta tardando ~40s. Sin avisar,
// la app parecía congelada y daba la impresión de estar rota. Con esto el
// usuario ve un punto de color y sabe exactamente qué está pasando.
//
// `despertando` no es lo mismo que `caido`: mientras Render arranca, la
// petición simplemente tarda; recién si vence el timeout o falla se considera
// caído. Esa distinción es la que evita el falso "no hay conexión".
export type EstadoConexion = 'verificando' | 'despertando' | 'conectado' | 'caido'

interface ConexionValue {
  estado: EstadoConexion
  /** Momento de la última comprobación exitosa (para "actualizado hace X"). */
  ultimoOk: number | null
  /**
   * Hay una comprobación en vuelo. Se expone para que el botón "Reintentar"
   * muestre que está trabajando: sin esto, si la red falla rápido el botón
   * parece no hacer nada al pulsarlo.
   */
  comprobando: boolean
  /** Fuerza una comprobación inmediata (botón "Reintentar"). */
  verificar: () => void
}

const ConexionContext = createContext<ConexionValue>({
  estado: 'verificando',
  ultimoOk: null,
  comprobando: false,
  verificar: () => {},
})

// Render tarda ~40s en despertar; se deja margen. Pasado esto se da por caído.
const TIMEOUT_MS = 75_000
// A partir de este tiempo sin responder se asume que está despertando, no caído.
const UMBRAL_DESPERTANDO_MS = 2_500
const INTERVALO_CONECTADO_MS = 60_000
const INTERVALO_CAIDO_MS = 15_000

export function ConexionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoConexion>('verificando')
  const [ultimoOk, setUltimoOk] = useState<number | null>(null)
  const [comprobando, setComprobando] = useState(false)
  const enCurso = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(true)

  const verificar = useCallback(async () => {
    if (enCurso.current) return
    enCurso.current = true
    if (montado.current) setComprobando(true)

    // Si tarda más de un instante, es que Render está arrancando: se avisa en
    // vez de dejar al usuario mirando una pantalla quieta.
    const marcarDespertando = setTimeout(() => {
      if (montado.current) setEstado(prev => (prev === 'conectado' ? prev : 'despertando'))
    }, UMBRAL_DESPERTANDO_MS)

    const abort = new AbortController()
    const cancelar = setTimeout(() => abort.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(apiUrl('/health'), { signal: abort.signal })
      const cuerpo = await res.json().catch(() => null)
      if (!montado.current) return
      if (res.ok && cuerpo?.ok) {
        setEstado('conectado')
        setUltimoOk(Date.now())
      } else {
        // Responde el proceso pero la base no: la app no sirve igual.
        setEstado('caido')
      }
    } catch {
      if (montado.current) setEstado('caido')
    } finally {
      clearTimeout(marcarDespertando)
      clearTimeout(cancelar)
      enCurso.current = false
      if (montado.current) setComprobando(false)
    }
  }, [])

  // Reprograma la siguiente comprobación según el estado: más seguido si está
  // caído (para detectar en cuanto vuelva), espaciado si está sano.
  useEffect(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    const espera = estado === 'conectado' ? INTERVALO_CONECTADO_MS : INTERVALO_CAIDO_MS
    temporizador.current = setTimeout(() => {
      void verificar()
    }, espera)
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [estado, verificar])

  // Primera comprobación + al volver del segundo plano (ahí es donde Render
  // suele haberse dormido mientras la app estaba minimizada).
  useEffect(() => {
    montado.current = true
    void verificar()
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') void verificar()
    })
    return () => {
      montado.current = false
      sub.remove()
    }
  }, [verificar])

  return (
    <ConexionContext.Provider value={{ estado, ultimoOk, comprobando, verificar: () => void verificar() }}>
      {children}
    </ConexionContext.Provider>
  )
}

export function useConexion(): ConexionValue {
  return useContext(ConexionContext)
}
