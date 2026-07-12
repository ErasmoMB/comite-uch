// app/index.tsx
import { Redirect } from 'expo-router'
import { useApp } from '../src/state/AppContext'
import { Loading } from '../src/components/ui'
import { View } from 'react-native'

export default function Index() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Iniciando…" /></View>
  return <Redirect href={usuario ? '/(app)' : '/login'} />
}
