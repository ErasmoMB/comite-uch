import { useNavigate } from 'react-router-dom'
import type { EstadoProyecto } from '../data/types'
import { ESTADO_LABEL } from '../lib/mappers'
import { MOSTRAR_LOGO } from '../lib/marca'
import type { ReactNode } from 'react'

export function Logo({ size = 52 }: { size?: number }) {
  if (!MOSTRAR_LOGO) return null
  return (
    <img
      src="/uch.png"
      alt="UCH"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        objectFit: 'cover',
        flex: 'none',
      }}
    />
  )
}

export function TopBar({ titulo, atras = true, extra }: { titulo: string; atras?: boolean; extra?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="topbar">
      {atras && (
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">
          ‹
        </button>
      )}
      <h1 style={{ flex: 1 }}>{titulo}</h1>
      {extra}
    </header>
  )
}

export function StatusBadge({ estado }: { estado: EstadoProyecto }) {
  return <span className={`badge badge-${estado}`}>{ESTADO_LABEL[estado]}</span>
}

export function Stepper({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <div className="stepper">
      {pasos.map((nombre, i) => (
        <div key={nombre} style={{ display: 'contents' }}>
          {i > 0 && <div className={`bar ${i <= actual ? 'done' : ''}`} />}
          <div className={`step ${i === actual ? 'active' : i < actual ? 'done' : ''}`}>
            <div className="dot">{i < actual ? '✓' : i + 1}</div>
            <span>{nombre}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
