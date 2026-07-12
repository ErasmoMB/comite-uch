// app/(app)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { useApp } from '../../src/state/AppContext'
import { Loading } from '../../src/components/ui'
import { colors } from '../../src/lib/theme'
import { homeGroupForRole } from '../../src/lib/roles'

// Icono textual simple (sin librería de iconos); se puede sustituir por @expo/vector-icons luego.
function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{label}</Text>
}

export default function AppLayout() {
  const { usuario, cargandoSesion } = useApp()
  if (cargandoSesion) return <View style={{ flex: 1 }}><Loading label="Cargando…" /></View>
  if (!usuario) return <Redirect href="/login" />
  // Si el rol no corresponde a este grupo (p. ej. secretaría llegó a mano),
  // mándalo a su propio grupo en vez de mostrarle el tab bar del solicitante.
  if (homeGroupForRole(usuario.rol) !== '/(app)') {
    return <Redirect href={homeGroupForRole(usuario.rol)} />
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.slate400 }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color }) => <TabIcon label="⌂" color={color} /> }} />
      <Tabs.Screen name="proyectos/index" options={{ title: 'Proyectos', tabBarIcon: ({ color }) => <TabIcon label="▤" color={color} /> }} />
      <Tabs.Screen name="nuevo/index" options={{ title: 'Nuevo', tabBarIcon: ({ color }) => <TabIcon label="＋" color={color} /> }} />
      <Tabs.Screen name="consultas" options={{ title: 'Consultas', tabBarIcon: ({ color }) => <TabIcon label="💬" color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon label="◔" color={color} /> }} />
      {/* Rutas sin pestaña propia (se ocultan del tab bar) */}
      <Tabs.Screen name="proyectos/[id]" options={{ href: null }} />
      <Tabs.Screen name="nuevo/exito" options={{ href: null }} />
      <Tabs.Screen name="cambiar-titulo" options={{ href: null }} />
    </Tabs>
  )
}
