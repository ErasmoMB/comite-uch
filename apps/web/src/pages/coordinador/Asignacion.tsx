import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import { TopBar, StatusBadge } from '../../components/shared'
import { ApiError } from '../../lib/http'
import { evaluacionService, expedientesService, usersService } from '../../services'
import type { EvaluacionDto, ExpedienteDto, UserDto } from '../../types/api'

export default function Asignacion() {
  const { id } = useParams()
  const expedienteId = Number(id)
  const navigate = useNavigate()

  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [evaluadores, setEvaluadores] = useState<UserDto[]>([])
  const [evaluacionExistente, setEvaluacionExistente] = useState<EvaluacionDto | null>(null)
  const [pendientesPorEvaluador, setPendientesPorEvaluador] = useState<Record<number, number>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [asignando, setAsignando] = useState(false)
  const [asignError, setAsignError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(expedienteId)) {
      setError('El identificador del expediente no es válido.')
      setCargando(false)
      return
    }

    let vivo = true
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const [exp, disponibles, evaluaciones] = await Promise.all([
          expedientesService.getById(expedienteId),
          usersService.evaluadoresDisponibles(),
          evaluacionService.list(0, 500),
        ])
        if (!vivo) return
        setExpediente(exp)
        setEvaluadores(disponibles)
        setEvaluacionExistente(evaluaciones.find(e => e.expedienteId === expedienteId) ?? null)

        // Carga REAL de cada evaluador: cuántas evaluaciones tiene asignadas
        // ahora mismo sin completar. Reemplaza al campo estático
        // `cargaTrabajo` del usuario (lo carga el admin a mano al crear la
        // cuenta y nunca se actualiza solo, así que no refleja la realidad).
        const pendientes: Record<number, number> = {}
        for (const e of evaluaciones) {
          if (!e.completa) pendientes[e.evaluadorId] = (pendientes[e.evaluadorId] ?? 0) + 1
        }
        setPendientesPorEvaluador(pendientes)
      } catch (err) {
        if (!vivo) return
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la información del expediente.')
      } finally {
        if (vivo) setCargando(false)
      }
    }
    cargar()
    return () => {
      vivo = false
    }
  }, [expedienteId])

  async function asignar() {
    if (!seleccionado) return
    setAsignando(true)
    setAsignError(null)
    try {
      const evaluacion = await evaluacionService.asignarUnEvaluador(expedienteId, seleccionado)
      setEvaluacionExistente(evaluacion)
    } catch (err) {
      // asignarUnEvaluador puede lanzar tanto ApiError (fallas del backend) como
      // un Error simple ("ya tiene un evaluador asignado"); ambos son Error.
      setAsignError(err instanceof Error ? err.message : 'No se pudo asignar el evaluador. Intenta nuevamente.')
    } finally {
      setAsignando(false)
    }
  }

  function nombreEvaluadorAsignado(): string {
    if (!evaluacionExistente) return ''
    if (evaluacionExistente.evaluador) {
      return `${evaluacionExistente.evaluador.nombre} ${evaluacionExistente.evaluador.apellido}`
    }
    const u = evaluadores.find(u => u.id === evaluacionExistente.evaluadorId)
    return u ? `${u.nombre} ${u.apellido}` : `evaluador #${evaluacionExistente.evaluadorId}`
  }

  // El menos cargado primero, para que sea el sugerido natural al asignar.
  const evaluadoresOrdenados = [...evaluadores].sort(
    (a, b) => (pendientesPorEvaluador[a.id] ?? 0) - (pendientesPorEvaluador[b.id] ?? 0),
  )

  const cuerpo = (
    <>
      {cargando && (
        <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>
          Cargando expediente…
        </p>
      )}

      {!cargando && error && (
        <div className="card" style={{ padding: '13px 14px', color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!cargando && !error && expediente && (
        <>
          <div className="card" style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span className="small" style={{ fontWeight: 600, color: 'var(--slate-400)' }}>
                {expediente.codigoUnico ?? '—'}
              </span>
              <StatusBadge estado={expediente.estado} />
            </div>
            <strong style={{ fontSize: 15, lineHeight: 1.35 }}>{expediente.tituloProtocolo}</strong>
          </div>

          {evaluacionExistente ? (
            <div
              style={{
                background: 'var(--success-bg)',
                border: '1px solid var(--line-soft)',
                borderRadius: 12,
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>Ya asignado</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{nombreEvaluadorAsignado()}</div>
              <p className="small muted" style={{ margin: '6px 0 0' }}>
                Este expediente ya tiene un evaluador asignado. Solo se permite uno por expediente.
              </p>
            </div>
          ) : (
            <>
              <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Selecciona un evaluador</strong>
              <div className="card" style={{ overflow: 'hidden' }}>
                {evaluadoresOrdenados.map(ev => {
                  const pendientes = pendientesPorEvaluador[ev.id] ?? 0
                  return (
                    <label key={ev.id} className="list-row" style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <input
                          type="radio"
                          name="evaluador"
                          checked={seleccionado === ev.id}
                          onChange={() => setSeleccionado(ev.id)}
                          style={{ width: 18, height: 18, accentColor: 'var(--primary)', flex: 'none' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.nombre} {ev.apellido}
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--slate-400)' }}>
                            {ev.especialidad ?? 'Sin especialidad'}
                          </div>
                        </div>
                      </div>
                      <span
                        className="badge"
                        style={{
                          flex: 'none',
                          background: pendientes === 0 ? 'var(--success-bg)' : 'var(--chip-bg)',
                          color: pendientes === 0 ? 'var(--success)' : 'var(--slate-500)',
                        }}
                      >
                        {pendientes} pendiente{pendientes === 1 ? '' : 's'}
                      </span>
                    </label>
                  )
                })}
                {evaluadores.length === 0 && (
                  <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
                    No hay evaluadores disponibles en este momento.
                  </p>
                )}
              </div>

              {asignError && <div className="field-error">{asignError}</div>}
            </>
          )}
        </>
      )}
    </>
  )

  return (
    <>
      <div className="mobile-only">
        <TopBar titulo="Asignar evaluador" />
        <div className="screen-body" style={{ padding: '15px 16px 24px', gap: 12 }}>{cuerpo}</div>
        {!cargando && !error && expediente && !evaluacionExistente && evaluadores.length > 0 && (
          <div style={{ padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid var(--line-soft)' }}>
            <button className="btn btn-primary" disabled={!seleccionado || asignando} onClick={asignar}>
              {asignando ? 'Asignando…' : 'Asignar'}
            </button>
          </div>
        )}
        {!cargando && !error && expediente && evaluacionExistente && (
          <div style={{ padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid var(--line-soft)' }}>
            <button className="btn btn-outline" onClick={() => navigate('/coordinador/dashboard')}>
              Volver al panel
            </button>
          </div>
        )}
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar
            left={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{ color: 'var(--slate-400)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => navigate('/coordinador/dashboard')}
                >
                  Panel de coordinación ›
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {expediente?.codigoUnico ?? 'Asignar evaluador'}
                </span>
              </div>
            }
          />
          <div className="d-content">
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              {cuerpo}

              {!cargando && !error && expediente && !evaluacionExistente && evaluadores.length > 0 && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="d-btn-primary" disabled={!seleccionado || asignando} onClick={asignar}>
                    {asignando ? 'Asignando…' : 'Asignar'}
                  </button>
                  <button className="d-btn-ghost" onClick={() => navigate('/coordinador/dashboard')}>
                    Cancelar
                  </button>
                </div>
              )}

              {!cargando && !error && expediente && evaluacionExistente && (
                <div>
                  <button className="d-btn-ghost" onClick={() => navigate('/coordinador/dashboard')}>
                    Volver al panel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
