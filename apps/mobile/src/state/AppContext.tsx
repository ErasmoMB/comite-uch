// src/state/AppContext.tsx
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
  login: (correo: string, clave: string) => Promise<Usuario>
  logout: () => Promise<void>
  registrar: (payload: RegisterPayload) => Promise<void>
  refrescarNotificaciones: () => Promise<void>
  marcarNotifsLeidas: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])

  async function refrescarNotificaciones() {
    try {
      const lista = await notificacionesService.list(0, 50)
      setNotificaciones(lista.map(toDomainNotificacion))
    } catch {
      // sesión aún no lista o backend no disponible; se reintenta
    }
  }

  useEffect(() => {
    setUnauthorizedHandler(() => setUsuario(null))
    async function hidratar() {
      const token = await getToken()
      if (!token) {
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
      login: async (correo, clave) => {
        const dto = await authService.login({ email: correo, password: clave })
        const u = toDomainUser(dto)
        setUsuario(u)
        return u
      },
      logout: async () => {
        await authService.logout()
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
    }),
    [usuario, cargandoSesion, notificaciones],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
