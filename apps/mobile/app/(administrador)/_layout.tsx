// app/(administrador)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { View } from 'react-native'
import TabIcon from '../../src/components/TabIcon'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { homeGroupForRole } from '../../src/lib/roles'

export default function AdministradorLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el usuario no es administrador, mándalo a su propio grupo (evita ver
  // pantallas que no le corresponden si navega a mano a esta URL).
  if (homeGroupForRole(usuario.rol) !== '/(administrador)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Usuarios', tabBarIcon: ({ color }) => <TabIcon name="usuarios" color={color} /> }} />
      <Tabs.Screen name="configuracion" options={{ title: 'Config', tabBarIcon: ({ color }) => <TabIcon name="configuracion" color={color} /> }} />
      <Tabs.Screen name="reportes" options={{ title: 'Reportes', tabBarIcon: ({ color }) => <TabIcon name="reportes" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon name="perfil" color={color} /> }} />
    </Tabs>
  )
}
