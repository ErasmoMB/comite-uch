// src/components/charts/StackedHBarChart.tsx
import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../lib/theme'
import { porcentajeSegmento, totalValores } from '../../lib/chartBars'

export interface StackedDatum {
  key: string
  label: string
  value: number
  color: string
}

// Puerto nativo de apps/web/src/components/charts/StackedHBarChart.tsx: una sola
// barra dividida en segmentos proporcionales + leyenda debajo. Sin librería, sin
// tooltip (el valor va en la leyenda). Los segmentos se separan por un gap de 2px
// que deja ver el fondo blanco de la barra (igual que la web).
export default function StackedHBarChart({ data }: { data: StackedDatum[] }) {
  const total = totalValores(data.map(d => d.value))
  if (total === 0) {
    return <Text style={s.vacio}>Aún no hay evaluaciones completas.</Text>
  }
  return (
    <View style={{ gap: 14 }}>
      <View style={s.barra}>
        {data.filter(d => d.value > 0).map(d => (
          <View key={d.key} style={{ width: `${porcentajeSegmento(d.value, total)}%`, backgroundColor: d.color, minWidth: 3 }} />
        ))}
      </View>
      <View style={s.leyenda}>
        {data.map(d => (
          <View key={d.key} style={s.item}>
            <View style={[s.punto, { backgroundColor: d.color }]} />
            <Text style={s.itemLabel}>{d.label}</Text>
            <Text style={s.itemValor}>{d.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  barra: { flexDirection: 'row', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2, backgroundColor: colors.white },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto: { width: 10, height: 10, borderRadius: 3 },
  itemLabel: { fontSize: 12.5, color: colors.slate700 },
  itemValor: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  vacio: { fontSize: 13, color: colors.slate500 },
})
