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
  value, onChange, placeholder = 'Seleccionar fecha', minimumDate, maximumDate, style,
}: {
  value: string
  onChange: (value: string) => void
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
    <View>
      <Pressable style={[s.input, style]} onPress={() => setMostrar(true)}>
        <Text style={value ? s.valor : s.placeholder}>{value ? formatearFecha(value) : placeholder}</Text>
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
  valor: { fontSize: 15, color: colors.ink },
  placeholder: { fontSize: 15, color: colors.slate400 },
  icono: { fontSize: 15, marginLeft: 8 },
})
