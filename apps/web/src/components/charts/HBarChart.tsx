import { useState } from 'react'

export interface HBarDatum {
  key: string
  label: string
  value: number
  color: string
}

interface Props {
  data: HBarDatum[]
  formatValue?: (v: number) => string
}

// Gráfico de barras horizontales: una fila por categoría, barra fina con
// extremo redondeado, etiqueta directa (nombre + valor) y tooltip al pasar
// el mouse. El máximo se calcula sobre los datos (no hay eje con marcas,
// las barras ya llevan su valor al lado).
export default function HBarChart({ data, formatValue = String }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...data.map(d => d.value))

  if (data.length === 0) {
    return <p className="muted small" style={{ margin: 0 }}>Sin datos por el momento.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => {
        const pct = Math.max(2, Math.round((d.value / max) * 100))
        const activo = hover === d.key
        return (
          <div
            key={d.key}
            onMouseEnter={() => setHover(d.key)}
            onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}
          >
            <span
              className="hbar-label"
              style={{
                fontWeight: 600,
                color: 'var(--slate-700)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {d.label}
            </span>
            <div style={{ flex: 1, height: 14, background: 'var(--line-soft)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: d.color,
                  borderRadius: '0 4px 4px 0',
                  opacity: activo ? 1 : 0.9,
                  transition: 'width .25s ease, opacity .15s ease',
                }}
              />
            </div>
            <span className="hbar-value" style={{ fontWeight: 700, color: 'var(--ink)' }}>
              {formatValue(d.value)}
            </span>
            {activo && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: '100%',
                  marginBottom: 6,
                  background: 'var(--navy)',
                  color: '#fff',
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '5px 9px',
                  borderRadius: 7,
                  whiteSpace: 'nowrap',
                  zIndex: 5,
                  pointerEvents: 'none',
                }}
              >
                {formatValue(d.value)} · {d.label}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
