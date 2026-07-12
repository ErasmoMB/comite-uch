// app/(secretaria)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { homeGroupForRole } from '../../src/lib/roles'

// Icono textual simple (mismo criterio que el layout del solicitante).
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{label}</Text>
}

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
      <Tabs.Screen name="index" options={{ title: 'Bandeja', tabBarIcon: ({ color }) => <TabIcon label="▤" color={color} /> }} />
      <Tabs.Screen name="chat/index" options={{ title: 'Chat', tabBarIcon: ({ color }) => <TabIcon label="💬" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon label="◔" color={color} /> }} />
      {/* Rutas sin pestaña propia (se ocultan del tab bar). */}
      <Tabs.Screen name="revision/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[solicitanteId]" options={{ href: null }} />
    </Tabs>
  )
}
