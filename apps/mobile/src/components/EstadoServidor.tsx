import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../lib/theme'
import { useConexion, type EstadoConexion } from '../state/ConexionContext'

const COLOR: Record<EstadoConexion, string> = {
  verificando: colors.slate400,
  despertando: colors.warn,
  conectado: colors.success,
  caido: colors.danger,
}

const ETIQUETA: Record<EstadoConexion, string> = {
  verificando: 'Conectando…',
  despertando: 'Iniciando servidor…',
  conectado: 'En línea',
  caido: 'Servidor inactivo',
}

/** Punto de color + etiqueta. Va en la barra superior de cada pantalla. */
export function PuntoEstado({ conEtiqueta = true }: { conEtiqueta?: boolean }) {
  const { estado, verificar } = useConexion()
  return (
    <Pressable onPress={verificar} hitSlop={8} style={s.chip} accessibilityLabel={`Servidor: ${ETIQUETA[estado]}`}>
      <View style={[s.punto, { backgroundColor: COLOR[estado] }]} />
      {conEtiqueta && <Text style={[s.etiqueta, { color: COLOR[estado] }]}>{ETIQUETA[estado]}</Text>}
    </Pressable>
  )
}

/**
 * Cubre la app mientras el backend no responde. Se muestra SOLO cuando está
 * `caido` o `despertando`: dejar operar sin servidor produciría errores en
 * cada acción y daría la impresión de que la app está rota.
 */
export function BloqueoSinServidor({ children }: { children: React.ReactNode }) {
  const { estado, comprobando, verificar } = useConexion()

  if (estado === 'conectado') return <>{children}</>

  const esperando = estado === 'verificando' || estado === 'despertando'

  return (
    <View style={s.overlay}>
      <View style={s.tarjeta}>
        <View style={[s.puntoGrande, { backgroundColor: COLOR[estado] }]} />

        {esperando ? (
          <>
            <Text style={s.titulo}>
              {estado === 'despertando' ? 'Iniciando el servidor' : 'Conectando'}
            </Text>
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 4 }} />
            <Text style={s.texto}>
              {estado === 'despertando'
                ? 'El servidor estaba en reposo y se está encendiendo. Puede tardar cerca de un minuto la primera vez.'
                : 'Comprobando la conexión con el servidor…'}
            </Text>
          </>
        ) : (
          <>
            <Text style={s.titulo}>Servidor inactivo</Text>
            <Text style={s.texto}>
              El servidor no está respondiendo, así que la app no puede cargar ni guardar datos.
              Revisa tu conexión a internet y vuelve a intentarlo.
            </Text>
            <Pressable
              onPress={verificar}
              disabled={comprobando}
              style={[s.boton, comprobando && s.botonInactivo]}
            >
              {comprobando ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.botonTexto}>Comprobando…</Text>
                </View>
              ) : (
                <Text style={s.botonTexto}>Reintentar</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  etiqueta: { fontSize: 11.5, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjeta: {
    backgroundColor: '#fff', borderRadius: 14, padding: 22, gap: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.lineSoft, maxWidth: 380, width: '100%',
  },
  puntoGrande: { width: 14, height: 14, borderRadius: 7, marginBottom: 2 },
  titulo: { fontSize: 16.5, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  texto: { fontSize: 13.5, color: colors.slate500, textAlign: 'center', lineHeight: 20 },
  boton: {
    marginTop: 6, backgroundColor: colors.primary, paddingVertical: 12,
    paddingHorizontal: 26, borderRadius: 10,
  },
  botonInactivo: { opacity: 0.7 },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
})
