import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { TopBar } from '../components/shared'
import { ApiError } from '../lib/http'
import { expedientesService } from '../services'
import type { ExpedienteRechazadoDto } from '../types/api'

// Observación 4 del Comité: el solicitante levanta las observaciones de un
// proyecto rechazado/observado (`GET /mis-rechazados`) y lo reenvía a la cola
// (`POST /:id/reenviar`), con tope de 3 intentos por expediente.
export default function ReenviarProyecto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const expedienteId = Number(id)

  const [proyecto, setProyecto] = useState<ExpedienteRechazadoDto | null>(null)
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
        const items = await expedientesService.getMisRechazados()
        if (!activo) return
        const encontrado = items.find(p => p.id === expedienteId) ?? null
        if (!encontrado) {
          setNoEncontrado(true)
        } else {
          setProyecto(encontrado)
        }
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

  if (noEncontrado) return <Navigate to="/proyectos/rechazados" replace />

  if (cargando || !proyecto) {
    return (
      <>
        <TopBar titulo="Reenviar proyecto" />
        <div className="screen-body" style={{ padding: '15px 16px 24px' }}>
          <p className="small muted">Cargando proyecto…</p>
        </div>
      </>
    )
  }

  if (!proyecto.puedeReenviar) return <Navigate to="/proyectos/rechazados" replace />

  async function reenviar() {
    if (!respuesta.trim()) {
      setError('Describe cómo levantaste las observaciones.')
      return
    }
    setError('')
    setEnviando(true)
    try {
      await expedientesService.reenviar(proyecto!.id, respuesta.trim())
      navigate(`/proyectos/${proyecto!.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reenviar el proyecto.')
    } finally {
      setEnviando(false)
    }
  }

  const titulo = `Reenviar · ${proyecto.codigoUnico ?? proyecto.tituloProtocolo}`

  const bloqueObservaciones = (
    <>
      <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
        Observaciones a levantar ({proyecto.intentos} de {proyecto.intentosMaximos} intentos usados)
      </strong>
      {proyecto.observaciones.length === 0 ? (
        <p className="small muted">Este proyecto no tiene observaciones registradas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {proyecto.observaciones.map((o, i) => (
            <div
              key={i}
              style={{
                background: 'var(--warn-bg)',
                border: '1px solid var(--warn-line)',
                borderLeft: '3px solid var(--warn)',
                borderRadius: 10,
                padding: '12px 13px',
              }}
            >
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--warn-ink)' }}>
                <strong>{o.origen}:</strong> {o.texto}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      <div className="mobile-only">
        <TopBar titulo={titulo} />
        <div className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }}>
          {bloqueObservaciones}

          <div className="field">
            <label>Respuesta consolidada</label>
            <textarea
              className="textarea"
              placeholder="Se corrigió el título duplicado y se actualizó el consentimiento informado…"
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>{bloqueObservaciones}</div>

              <div className="card" style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
                <div>
                  <div className="d-field-label">Respuesta consolidada</div>
                  <textarea
                    className="d-field d-textarea"
                    style={{ minHeight: 96 }}
                    placeholder="Se corrigió el título duplicado y se actualizó el consentimiento informado…"
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
