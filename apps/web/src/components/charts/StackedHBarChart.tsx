import { useState } from 'react'

export interface StackedDatum {
  key: string
  label: string
  value: number
  color: string
}

interface Props {
  data: StackedDatum[]
}

// Una sola barra horizontal dividida en segmentos (parte-del-todo), con
// leyenda debajo -- para "de todo lo evaluado, qué proporción salió cada
// resultado". Cada segmento separado por un gap de 2px en el color de la
// superficie (nunca un borde) y con su propio tooltip al pasar el mouse.
export default function StackedHBarChart({ data }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const total = data.reduce((acc, d) => acc + d.value, 0)

  if (total === 0) {
    return <p className="muted small" style={{ margin: 0 }}>Aún no hay evaluaciones completas.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', gap: 2, background: '#fff' }}>
        {data
          .filter(d => d.value > 0)
          .map(d => {
            const pct = (d.value / total) * 100
            const activo = hover === d.key
            return (
              <div
                key={d.key}
                onMouseEnter={() => setHover(d.key)}
                onMouseLeave={() => setHover(null)}
                style={{
                  position: 'relative',
                  width: `${pct}%`,
                  background: d.color,
                  opacity: activo ? 1 : 0.92,
                  transition: 'opacity .15s ease',
                  minWidth: 3,
                }}
              >
                {activo && (
                  <div
                    role="tooltip"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)',
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
                    {d.value} · {d.label} ({Math.round(pct)}%)
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
        {data.map(d => (
          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flex: 'none' }} />
            <span style={{ fontSize: 12.5, color: 'var(--slate-700)' }}>{d.label}</span>
            <strong style={{ fontSize: 12.5 }}>{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
