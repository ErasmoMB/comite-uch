import { useEffect, useState } from 'react'
import BottomNav from '../../components/BottomNav'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import { formatearFecha } from '../../lib/dates'
import { ApiError } from '../../lib/http'
import { configService } from '../../services'
import { useConfirm } from '../../state/ConfirmContext'

function toInputValue(fecha: string | null): string {
  if (!fecha) return ''
  return fecha.slice(0, 10)
}

export default function Configuracion() {
  const confirmar = useConfirm()
  const [fechaLimite, setFechaLimite] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const dto = await configService.getFechaLimite()
      setFechaLimite(dto.fechaLimite)
      setValor(toInputValue(dto.fechaLimite))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la fecha límite.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(''), 3500)
    return () => clearTimeout(t)
  }, [mensaje])

  async function guardar() {
    if (!valor) {
      setError('Selecciona una fecha.')
      return
    }
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      const dto = await configService.setFechaLimite(valor)
      setFechaLimite(dto.fechaLimite)
      setMensaje('Fecha límite guardada correctamente.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la fecha límite.')
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    if (!(await confirmar('¿Quitar la fecha límite configurada?', { titulo: 'Quitar fecha límite' }))) return
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      const dto = await configService.setFechaLimite(null)
      setFechaLimite(dto.fechaLimite)
      setValor('')
      setMensaje('Fecha límite eliminada.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar la fecha límite.')
    } finally {
      setGuardando(false)
    }
  }

  const contenido = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <strong style={{ fontSize: 15 }}>Fecha límite de envío de protocolos</strong>

      {cargando && <p className="muted small">Cargando configuración…</p>}

      {!cargando && (
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
          <div style={{ fontSize: 13, color: 'var(--slate-500)' }}>
            {fechaLimite ? `Fecha límite actual: ${formatearFecha(fechaLimite)}` : 'No hay una fecha límite configurada.'}
          </div>

          <div className="field">
            <label>Nueva fecha límite</label>
            <input className="input" type="date" value={valor} onChange={e => setValor(e.target.value)} />
          </div>

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
          {mensaje && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>{mensaje}</p>
          )}

          <div className="btn-row">
            <button className="btn btn-outline" disabled={guardando || !fechaLimite} onClick={quitar}>
              Quitar fecha límite
            </button>
            <button className="btn btn-primary" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="mobile-only">
        <header className="topbar" style={{ borderBottom: '1px solid var(--line-soft)' }}>
          <h1>Configuración</h1>
        </header>
        <div className="screen-body" style={{ padding: '16px', gap: 14 }}>
          {contenido}
        </div>
        <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Configuración" />
          <div className="d-content">{contenido}</div>
        </div>
      </div>
    </>
  )
}
