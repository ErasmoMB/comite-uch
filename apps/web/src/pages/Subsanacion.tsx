import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { TopBar } from '../components/shared'
import { ApiError } from '../lib/http'
import { expedientesService } from '../services'
import type { ExpedienteDto, HistorialDto } from '../types/api'

export default function Subsanacion() {
  const { id } = useParams()
  const navigate = useNavigate()
  const expedienteId = Number(id)

  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [motivo, setMotivo] = useState<HistorialDto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)

  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      if (!Number.isFinite(expedienteId)) {
        setNoEncontrado(true)
        setCargando(false)
        return
      }
      try {
        const detalle = await expedientesService.getDetalle(expedienteId)
        if (!activo) return
        setExpediente(detalle.expediente)
        const ultimaSubsanacion = detalle.historial.find(h => h.estadoNuevo === 'subsanacion') ?? null
        setMotivo(ultimaSubsanacion)
      } catch {
        if (activo) setNoEncontrado(true)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [expedienteId])

  if (noEncontrado) return <Navigate to="/proyectos" replace />

  if (cargando || !expediente) {
    return (
      <>
        <TopBar titulo="Subsanación" />
        <div className="screen-body" style={{ padding: '15px 16px 24px' }}>
          <p className="small muted">Cargando proyecto…</p>
        </div>
      </>
    )
  }

  async function reenviar() {
    if (!respuesta.trim()) {
      setError('Describe cómo subsanaste las observaciones.')
      return
    }
    setError('')
    setEnviando(true)
    try {
      await expedientesService.subsanar(expediente!.id, respuesta.trim())
      navigate(`/proyectos/${expediente!.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reenviar la subsanación.')
    } finally {
      setEnviando(false)
    }
  }

  const titulo = `Subsanación · ${expediente.codigoUnico ?? expediente.tituloProtocolo}`

  return (
    <>
      <div className="mobile-only">
      <TopBar titulo={titulo} />
      <div className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }}>
        <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Observaciones de secretaría</strong>

        {motivo ? (
          <div
            style={{
              background: 'var(--warn-bg)',
              border: '1px solid var(--warn-line)',
              borderLeft: '3px solid var(--warn)',
              borderRadius: 10,
              padding: '12px 13px',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--warn-ink)' }}>
              {motivo.observaciones ?? 'Sin detalle adicional.'}
            </p>
          </div>
        ) : (
          <p className="small muted">Este proyecto no tiene observaciones registradas.</p>
        )}

        <div className="field">
          <label>Respuesta consolidada</label>
          <textarea
            className="textarea"
            placeholder="Se adjunta la validación de expertos y se actualizó el consentimiento con la cláusula solicitada…"
            value={respuesta}
            onChange={e => setRespuesta(e.target.value)}
          />
        </div>

        {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

        <button className="btn btn-primary" style={{ marginTop: 'auto' }} disabled={enviando} onClick={reenviar}>
          {enviando ? 'Enviando…' : 'Reenviar proyecto'}
        </button>
      </div>
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo={titulo} />
          <div className="d-content">
            <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }}>Observaciones de secretaría</div>
                {motivo ? (
                  <div
                    style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-line)', borderLeft: '3px solid var(--warn)', borderRadius: 10, padding: '14px 16px' }}
                  >
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--warn-ink)' }}>{motivo.observaciones ?? 'Sin detalle adicional.'}</div>
                  </div>
                ) : (
                  <p className="small muted">Este proyecto no tiene observaciones registradas.</p>
                )}
              </div>

              <div className="card" style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
                <div>
                  <div className="d-field-label">Respuesta consolidada</div>
                  <textarea
                    className="d-field d-textarea"
                    style={{ minHeight: 96 }}
                    placeholder="Se adjunta la validación de expertos y se actualizó el consentimiento con la cláusula solicitada…"
                    value={respuesta}
                    onChange={e => setRespuesta(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="field-error" style={{ margin: 0 }}>
                    {error}
                  </p>
                )}
                <div style={{ flex: 1 }} />
                <button className="d-btn-primary" style={{ width: '100%' }} disabled={enviando} onClick={reenviar}>
                  {enviando ? 'Enviando…' : 'Reenviar proyecto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
