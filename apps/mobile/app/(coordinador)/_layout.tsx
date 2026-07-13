// app/(coordinador)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { homeGroupForRole } from '../../src/lib/roles'

// Icono textual simple (mismo criterio que los otros layouts de grupo).
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{label}</Text>
}

export default function CoordinadorLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el usuario no es coordinador, mándalo a su propio grupo (evita ver
  // pantallas que no le corresponden si navega a mano a esta URL).
  if (homeGroupForRole(usuario.rol) !== '/(coordinador)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color }) => <TabIcon label="▤" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon label="◔" color={color} /> }} />
      {/* Ruta sin pestaña propia (se oculta del tab bar): se llega solo desde el Dashboard. */}
      <Tabs.Screen name="asignacion/[id]" options={{ href: null }} />
    </Tabs>
  )
}
