// src/components/charts/HBarChart.tsx
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../lib/theme'
import { anchoBarra, maximoValor } from '../../lib/chartBars'

export interface HBarDatum {
  key: string
  label: string
  value: number
  color: string
}

// Puerto nativo de apps/web/src/components/charts/HBarChart.tsx: una fila por
// categoría (etiqueta + barra proporcional con <View> + valor a la derecha). Sin
// librería de charts, sin tooltip de hover (en táctil el valor se muestra
// siempre). El ancho sale de anchoBarra() (misma matemática que la web).
export default function HBarChart({ data }: { data: HBarDatum[] }) {
  if (data.length === 0) {
    return <Text style={s.vacio}>Sin datos por el momento.</Text>
  }
  const max = maximoValor(data.map(d => d.value))
  return (
    <View style={{ gap: 10 }}>
      {data.map(d => (
        <View key={d.key} style={s.fila}>
          <Text numberOfLines={1} style={s.label}>{d.label}</Text>
          <View style={s.track}>
            <View style={{ height: '100%', width: `${anchoBarra(d.value, max)}%`, backgroundColor: d.color, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
          </View>
          <Text style={s.valor}>{d.value}</Text>
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 96, fontSize: 12, fontWeight: '600', color: colors.slate700 },
  track: { flex: 1, height: 14, backgroundColor: colors.lineSoft, borderRadius: 4, overflow: 'hidden' },
  valor: { width: 30, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: colors.ink },
  vacio: { fontSize: 13, color: colors.slate500 },
})
