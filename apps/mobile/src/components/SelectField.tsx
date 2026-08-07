import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '../lib/theme'

export interface OpcionSelect {
  valor: string
  etiqueta: string
}

/**
 * Desplegable de selección única.
 *
 * Sustituye a las filas de chips cuando las opciones son muchas o sus
 * etiquetas largas ("Estudiante de pregrado"): en un teléfono esa fila se
 * salía de la pantalla y la última opción quedaba cortada, sin ninguna pista
 * de que hubiera más. Aquí el valor elegido siempre se ve completo y las
 * opciones se listan en un modal, con el mismo estilo que ConfirmContext.
 */
export default function SelectField({
  valor, opciones, onChange, label, titulo, style,
}: {
  valor: string
  opciones: OpcionSelect[]
  onChange: (valor: string) => void
  label?: string
  /** Encabezado del modal. Por defecto usa `label`. */
  titulo?: string
  style?: StyleProp<ViewStyle>
}) {
  const [abierto, setAbierto] = useState(false)
  const seleccionada = opciones.find(o => o.valor === valor)

  return (
    <View style={style}>
      {!!label && <Text style={s.label}>{label}</Text>}

      <Pressable style={s.campo} onPress={() => setAbierto(true)}>
        <Text style={s.valor} numberOfLines={1}>
          {seleccionada?.etiqueta ?? '—'}
        </Text>
        <Text style={s.flecha}>▾</Text>
      </Pressable>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={s.backdrop} onPress={() => setAbierto(false)}>
          {/* Pressable interno con onPress vacío: evita que tocar la tarjeta
              cierre el modal (el toque no llega al backdrop). */}
          <Pressable style={s.tarjeta} onPress={() => {}}>
            <Text style={s.titulo}>{titulo ?? label ?? 'Seleccionar'}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {opciones.map(o => {
                const activa = o.valor === valor
                return (
                  <Pressable
                    key={o.valor}
                    style={[s.opcion, activa && s.opcionActiva]}
                    onPress={() => { onChange(o.valor); setAbierto(false) }}
                  >
                    <Text style={[s.opcionTexto, activa && s.opcionTextoActivo]}>{o.etiqueta}</Text>
                    {activa && <Text style={s.check}>✓</Text>}
                  </Pressable>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.slate700, marginBottom: 6 },
  campo: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  valor: { flexShrink: 1, fontSize: 15, color: colors.ink },
  flecha: { fontSize: 13, color: colors.slate500 },

  backdrop: { flex: 1, backgroundColor: 'rgba(8,32,74,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%', maxWidth: 420, gap: 4 },
  titulo: { fontSize: 15, fontWeight: '700', color: colors.navy, marginBottom: 6 },
  opcion: {
    paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  opcionActiva: { backgroundColor: colors.blue50 },
  opcionTexto: { fontSize: 15, color: colors.ink },
  opcionTextoActivo: { fontWeight: '700', color: colors.primary },
  check: { fontSize: 15, fontWeight: '700', color: colors.primary },
})
