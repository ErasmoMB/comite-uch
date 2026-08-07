// src/components/DateField.tsx
import { useState } from 'react'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '../lib/theme'
import { formatearFecha } from '../lib/dates'

export function parseFechaISO(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Fecha local en AAAA-MM-DD a partir del Date que devuelve el picker nativo
// (evita el corrimiento de día que da toISOString() al pasar por UTC).
function aISOLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export default function DateField({
  // Placeholder corto a propósito: estos campos suelen ir de a dos en una
  // misma fila (Desde/Hasta) en pantallas de teléfono, y un texto largo como
  // "Seleccionar fecha" se partía en dos líneas y descuadraba la fila.
  value, onChange, label, placeholder = 'dd/mm/aaaa', minimumDate, maximumDate, style,
}: {
  value: string
  onChange: (value: string) => void
  /** Etiqueta encima del campo (ej. "Desde"/"Hasta"). */
  label?: string
  placeholder?: string
  minimumDate?: Date
  maximumDate?: Date
  style?: StyleProp<ViewStyle>
}) {
  const [mostrar, setMostrar] = useState(false)

  function manejarCambio(evento: DateTimePickerEvent, seleccionada?: Date) {
    // En Android el diálogo nativo se cierra solo; en iOS queda abierto hasta
    // que el usuario lo confirme o lo cierre explícitamente.
    if (Platform.OS === 'android') setMostrar(false)
    if (evento.type === 'set' && seleccionada) onChange(aISOLocal(seleccionada))
  }

  return (
    // El `style` que llega de fuera (normalmente `flex: 1` para repartir el
    // ancho en una fila) va en el contenedor, NO en el Pressable: si se aplica
    // al Pressable, el View exterior sigue midiendo por contenido y el campo
    // no se reparte el ancho como espera quien lo usa.
    <View style={style}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <Pressable style={s.input} onPress={() => setMostrar(true)}>
        {/* flexShrink (no flex) + numberOfLines: el texto toma su ancho
            natural y solo se recorta si falta espacio. Con `flex: 1` se
            colapsaba a cero cuando el contenedor no tenía ancho definido. */}
        <Text style={value ? s.valor : s.placeholder} numberOfLines={1}>
          {value ? formatearFecha(value) : placeholder}
        </Text>
        <Text style={s.icono}>📅</Text>
      </Pressable>
      {mostrar && (
        <DateTimePicker
          value={parseFechaISO(value) ?? new Date()}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={manejarCambio}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.slate700, marginBottom: 6 },
  valor: { flexShrink: 1, fontSize: 15, color: colors.ink },
  placeholder: { flexShrink: 1, fontSize: 15, color: colors.slate400 },
  icono: { fontSize: 15, marginLeft: 6 },
})
