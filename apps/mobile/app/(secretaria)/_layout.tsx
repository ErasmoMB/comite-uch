// app/(secretaria)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { View } from 'react-native'
import TabIcon from '../../src/components/TabIcon'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { homeGroupForRole } from '../../src/lib/roles'

export default function SecretariaLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el usuario no es de secretaría, mándalo a su propio grupo (evita ver
  // pantallas que no le corresponden si navega a mano a esta URL).
  if (homeGroupForRole(usuario.rol) !== '/(secretaria)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Bandeja', tabBarIcon: ({ color }) => <TabIcon name="bandeja" color={color} /> }} />
      <Tabs.Screen name="chat/index" options={{ title: 'Chat', tabBarIcon: ({ color }) => <TabIcon name="chat" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon name="perfil" color={color} /> }} />
      {/* Rutas sin pestaña propia (se ocultan del tab bar). */}
      <Tabs.Screen name="revision/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[solicitanteId]" options={{ href: null }} />
    </Tabs>
  )
}
