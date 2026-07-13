// src/lib/chartBars.ts
// Cálculo puro de anchos/porcentajes para las barras nativas de Reportes
// (equivalente a la matemática de HBarChart/StackedHBarChart de la web). Se
// extrae y testea porque el mapeo valor->% es la única lógica no trivial del
// port a <View>s nativos.

// HBarChart: cada barra se escala contra el máximo del set, con piso de 2% para
// que un valor > 0 siempre sea visible. Calcado de la web:
// Math.max(2, Math.round(value / max * 100)), con max = Math.max(1, ...valores).
export function maximoValor(valores: number[]): number {
  return Math.max(1, ...valores)
}
export function anchoBarra(valor: number, maximo: number): number {
  const max = Math.max(1, maximo)
  return Math.max(2, Math.round((valor / max) * 100))
}

// StackedHBarChart: cada segmento es su proporción del total (value/total*100).
// El caller solo pinta segmentos con value > 0 (con minWidth para visibilidad).
export function totalValores(valores: number[]): number {
  return valores.reduce((acc, v) => acc + v, 0)
}
export function porcentajeSegmento(valor: number, total: number): number {
  if (total <= 0) return 0
  return (valor / total) * 100
}
