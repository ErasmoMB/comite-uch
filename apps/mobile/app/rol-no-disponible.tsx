// app/rol-no-disponible.tsx
import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { Button, Screen } from '../src/components/ui'
import { colors } from '../src/lib/theme'
import { ROL_LABEL } from '../src/data/types'
import { useApp } from '../src/state/AppContext'

export default function RolNoDisponible() {
  const { usuario, logout } = useApp()
  const router = useRouter()

  async function cerrarSesion() {
    await logout()
    router.replace('/login')
  }

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.navy, textAlign: 'center' }}>
          Tu rol todavía no está disponible en la app móvil
        </Text>
        <Text style={{ fontSize: 14, color: colors.slate500, textAlign: 'center' }}>
          {usuario ? `Rol: ${ROL_LABEL[usuario.rol]}. ` : ''}
          Por ahora, usa el sitio web del Comité de Ética para esta cuenta.
        </Text>
        <Button title="Cerrar sesión" variant="outline" onPress={cerrarSesion} style={{ marginTop: 12 }} />
      </View>
    </Screen>
  )
}
