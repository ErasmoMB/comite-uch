// app/index.tsx
import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { useApp } from '../src/state/AppContext'
import { Loading } from '../src/components/ui'
import { homeGroupForRole } from '../src/lib/roles'

export default function Index() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Iniciando…" /></View>
  return <Redirect href={usuario ? homeGroupForRole(usuario.rol) : '/login'} />
}
