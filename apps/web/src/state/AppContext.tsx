import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getToken, setUnauthorizedHandler } from '../lib/http'
import { toDomainNotificacion, toDomainUser } from '../lib/mappers'
import { authService, notificacionesService } from '../services'
import type { RegisterPayload } from '../services/auth.service'
import type { Notificacion, Usuario } from '../data/types'

interface AppState {
  usuario: Usuario | null
  cargandoSesion: boolean
  notificaciones: Notificacion[]
  sheetNotifAbierta: boolean
  login: (correo: string, clave: string) => Promise<Usuario>
  logout: () => void
  registrar: (payload: RegisterPayload) => Promise<void>
  refrescarNotificaciones: () => Promise<void>
  marcarNotifsLeidas: () => Promise<void>
  abrirNotifs: (abierta: boolean) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [sheetNotifAbierta, setSheetNotifAbierta] = useState(false)

  async function refrescarNotificaciones() {
    try {
      const lista = await notificacionesService.list(0, 50)
      setNotificaciones(lista.map(toDomainNotificacion))
    } catch {
      // sesión aún no lista o backend no disponible; se reintenta en el próximo ciclo
    }
  }

  useEffect(() => {
    setUnauthorizedHandler(() => setUsuario(null))

    async function hidratar() {
      if (!getToken()) {
        setCargandoSesion(false)
        return
      }
      try {
        const dto = await authService.getMe()
        setUsuario(toDomainUser(dto))
      } catch {
        setUsuario(null)
      } finally {
        setCargandoSesion(false)
      }
    }
    hidratar()
  }, [])

  useEffect(() => {
    if (!usuario) return
    refrescarNotificaciones()
    const t = setInterval(refrescarNotificaciones, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id])

  const value = useMemo<AppState>(
    () => ({
      usuario,
      cargandoSesion,
      notificaciones,
      sheetNotifAbierta,
      login: async (correo, clave) => {
        const dto = await authService.login({ email: correo, password: clave })
        const u = toDomainUser(dto)
        setUsuario(u)
        return u
      },
      logout: () => {
        authService.logout()
        setUsuario(null)
        setNotificaciones([])
      },
      registrar: async payload => {
        await authService.register(payload)
      },
      refrescarNotificaciones,
      marcarNotifsLeidas: async () => {
        await notificacionesService.marcarTodasLeidas()
        setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
      },
      abrirNotifs: abierta => setSheetNotifAbierta(abierta),
    }),
    [usuario, cargandoSesion, notificaciones, sheetNotifAbierta],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
