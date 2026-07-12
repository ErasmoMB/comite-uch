// app/index.tsx
import { Redirect, type Href } from 'expo-router'
import { View } from 'react-native'
import { useApp } from '../src/state/AppContext'
import { Loading } from '../src/components/ui'
import { homeGroupForRole } from '../src/lib/roles'

export default function Index() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Iniciando…" /></View>
  // Cast: expo-router typed-routes solo conoce rutas existentes en app/.
  // '/(secretaria)' recién existe físicamente desde Fase 4 Task 2.
  return <Redirect href={(usuario ? homeGroupForRole(usuario.rol) : '/login') as Href} />
}
