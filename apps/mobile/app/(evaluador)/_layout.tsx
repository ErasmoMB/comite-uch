// app/(evaluador)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { View } from 'react-native'
import TabIcon from '../../src/components/TabIcon'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { homeGroupForRole } from '../../src/lib/roles'

export default function EvaluadorLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el usuario no es evaluador, mándalo a su propio grupo (evita ver
  // pantallas que no le corresponden si navega a mano a esta URL).
  if (homeGroupForRole(usuario.rol) !== '/(evaluador)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Bandeja', tabBarIcon: ({ color }) => <TabIcon name="bandeja" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon name="perfil" color={color} /> }} />
      {/* Ruta sin pestaña propia (se oculta del tab bar): se llega solo desde la Bandeja. */}
      <Tabs.Screen name="evaluacion/[id]" options={{ href: null }} />
    </Tabs>
  )
}
