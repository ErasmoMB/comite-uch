import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { BloqueoSinServidor } from '../src/components/EstadoServidor'
import { AppProvider } from '../src/state/AppContext'
import { ConexionProvider } from '../src/state/ConexionContext'
import { ConfirmProvider } from '../src/state/ConfirmContext'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* `ConexionProvider` envuelve todo para que el estado del servidor sea
          único en la app. `BloqueoSinServidor` va por DENTRO de él y por FUERA
          del Stack: mientras el backend no responda no se monta ninguna
          pantalla, así ninguna dispara peticiones condenadas a fallar. */}
      <ConexionProvider>
        <BloqueoSinServidor>
          <ConfirmProvider>
            <AppProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </AppProvider>
          </ConfirmProvider>
        </BloqueoSinServidor>
      </ConexionProvider>
    </SafeAreaProvider>
  )
}
