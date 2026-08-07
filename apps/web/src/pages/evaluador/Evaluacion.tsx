import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import ConsultaIa from '../../components/ConsultaIa'
import DocumentPreviewModal, { type DocumentPreviewState } from '../../components/DocumentPreviewModal'
import { TopBar } from '../../components/shared'
import { descargarArchivo } from '../../lib/descargas'
import { ApiError } from '../../lib/http'
import { evaluacionService, expedientesService, iaService } from '../../services'
import type { SugerenciaCriterio } from '../../services/ia.service'
import { useConfirm } from '../../state/ConfirmContext'
import type { DocumentoDto, ExpedienteDto, RubricaDto } from '../../types/api'
import type { EvaluacionDto } from '../../types/api'

interface CriterioEstado {
  puntaje: string
  observacion: string
}

export default function Evaluacion() {
  const { id } = useParams()
  const evaluacionId = Number(id)
  const navigate = useNavigate()
  const confirmar = useConfirm()

  const [evaluacion, setEvaluacion] = useState<EvaluacionDto | null>(null)
  const [rubrica, setRubrica] = useState<RubricaDto | null>(null)
  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoDto[]>([])
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [criteriosEstado, setCriteriosEstado] = useState<Record<string, CriterioEstado>>({})
  const [observacionesGenerales, setObservacionesGenerales] = useState('')

  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [declarando, setDeclarando] = useState(false)

  // ---------- asistente de IA ----------
  // `sugerencias` guarda lo propuesto por criterio; `confirmados` marca cuáles
  // ya revisó la persona. Un criterio con sugerencia pendiente NO cuenta como
  // decidido: el envío queda bloqueado mientras quede alguno sin confirmar.
  const [iaDisponible, setIaDisponible] = useState(false)
  const [sugerencias, setSugerencias] = useState<Record<string, SugerenciaCriterio>>({})
  const [confirmados, setConfirmados] = useState<Record<string, boolean>>({})
  const [analizando, setAnalizando] = useState(false)
  const [errorIa, setErrorIa] = useState('')

  const pendientesIa = Object.keys(sugerencias).filter(k => !confirmados[k])

  useEffect(() => {
    iaService
      .estado()
      .then(r => setIaDisponible(r.disponible))
      .catch(() => setIaDisponible(false))
  }, [])

  async function analizarConIa(regenerar = false) {
    setAnalizando(true)
    setErrorIa('')
    try {
      const r = await iaService.sugerirRubrica(evaluacionId, regenerar)
      const porKey: Record<string, SugerenciaCriterio> = {}
      for (const c of r.criterios) porKey[c.key] = c
      setSugerencias(porKey)
      setConfirmados({})
      // La sugerencia se vuelca a los campos reales para que el evaluador la
      // edite en su sitio; hasta confirmarla se muestra en morado y no habilita
      // el envío.
      setCriteriosEstado(prev => {
        const next = { ...prev }
        for (const c of r.criterios) {
          next[c.key] = { puntaje: String(c.puntaje), observacion: c.justificacion }
        }
        return next
      })
    } catch (e) {
      setErrorIa(e instanceof ApiError ? e.message : 'No se pudo generar el borrador.')
    } finally {
      setAnalizando(false)
    }
  }

  function confirmarCriterio(key: string) {
    setConfirmados(prev => ({ ...prev, [key]: true }))
  }

  useEffect(() => {
    if (!Number.isFinite(evaluacionId)) return
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const [ev, rub] = await Promise.all([evaluacionService.getById(evaluacionId), evaluacionService.getRubrica()])
        if (cancelado) return
        setEvaluacion(ev)
        setRubrica(rub)
        setObservacionesGenerales(ev.observaciones ?? '')
        const inicial: Record<string, CriterioEstado> = {}
        for (const c of rub.criterios) {
          const existente = ev.criterios?.find(cr => cr.criterioKey === c.key)
          inicial[c.key] = {
            puntaje: existente?.puntaje != null ? String(existente.puntaje) : '',
            observacion: existente?.observacion ?? '',
          }
        }
        setCriteriosEstado(inicial)

        // El detalle de la evaluación no trae el expediente completo (solo
        // título/investigador/fecha aplanados) -- se busca aparte para
        // mostrar el resumen real (facultad, tipo, autores) y los documentos
        // a revisar.
        try {
          const detalle = await expedientesService.getDetalle(ev.expedienteId)
          if (cancelado) return
          setExpediente(detalle.expediente)
          setDocumentos(detalle.documentos)
        } catch {
          // No bloquea la evaluación en sí si esto falla; solo no se muestra
          // el resumen/documentos.
        }
      } catch (e) {
        if (!cancelado) setErrorCarga(e instanceof ApiError ? e.message : 'No se pudo cargar la evaluación.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [evaluacionId])

  const puntajeAcumulado = useMemo(() => {
    if (!rubrica) return 0
    return rubrica.criterios.reduce((acc, c) => acc + (Number(criteriosEstado[c.key]?.puntaje) || 0), 0)
  }, [rubrica, criteriosEstado])

  const resultadoPrevisto = useMemo(() => {
    if (!rubrica) return null
    // rubrica.umbrales llega como rangos descriptivos ("17-20", "13-16",
    // "0-12"), no números — se compara contra el límite inferior de cada rango.
    const limiteInferior = (rango: string) => Number(rango.split('-')[0])
    if (puntajeAcumulado >= limiteInferior(rubrica.umbrales.aprobado)) return 'Aprobado'
    if (puntajeAcumulado >= limiteInferior(rubrica.umbrales.aprobado_observaciones)) return 'Aprobado con observaciones'
    return 'No aprobado'
  }, [rubrica, puntajeAcumulado])

  const soloLectura = evaluacion?.completa === true
  const conflicto = evaluacion?.conflictoInteres === true
  const bloqueado = soloLectura || conflicto

  function actualizarCriterio(key: string, campo: keyof CriterioEstado, valor: string) {
    setCriteriosEstado(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }))
    // Tocar el puntaje o la observación ES la decisión humana: el criterio deja
    // de estar pendiente sin necesidad de pulsar "Aceptar" aparte.
    setConfirmados(prev => (prev[key] ? prev : { ...prev, [key]: true }))
  }

  function validarParaEnviar(): string | null {
    if (!rubrica) return 'La rúbrica aún no se ha cargado.'
    // La IA no puede cerrar un dictamen: mientras quede una sugerencia sin
    // revisar, el envío no procede.
    if (pendientesIa.length > 0) {
      return pendientesIa.length === 1
        ? 'Revisa la sugerencia de la IA que queda sin confirmar antes de enviar la evaluación.'
        : `Revisa las ${pendientesIa.length} sugerencias de la IA antes de enviar la evaluación.`
    }
    for (const c of rubrica.criterios) {
      const valor = criteriosEstado[c.key]?.puntaje ?? ''
      if (valor.trim() === '') return `Falta asignar el puntaje de "${c.nombre}".`
      const n = Number(valor)
      if (Number.isNaN(n) || n < 0 || n > c.puntajeMax) return `El puntaje de "${c.nombre}" debe estar entre 0 y ${c.puntajeMax}.`
    }
    return null
  }

  async function guardarAvance() {
    if (!evaluacion) return
    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const actualizado = await evaluacionService.guardarParcial(evaluacion.id, observacionesGenerales)
      setEvaluacion(actualizado)
      setMensaje('Avance guardado correctamente.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el avance.')
    } finally {
      setGuardando(false)
    }
  }

  async function enviarEvaluacion() {
    if (!evaluacion || !rubrica) return
    const problema = validarParaEnviar()
    if (problema) {
      setError(problema)
      setMensaje('')
      return
    }
    if (
      !(await confirmar('Esta acción no se puede deshacer.', {
        titulo: 'Enviar evaluación de forma definitiva',
        textoConfirmar: 'Enviar evaluación',
      }))
    )
      return

    setEnviando(true)
    setError('')
    setMensaje('')
    try {
      const actualizado = await evaluacionService.update(evaluacion.id, {
        observaciones: observacionesGenerales,
        completa: true,
        criterios: rubrica.criterios.map(c => ({
          key: c.key,
          puntaje: Number(criteriosEstado[c.key].puntaje),
          observacion: criteriosEstado[c.key].observacion.trim() || undefined,
        })),
      })
      setEvaluacion(actualizado)
      setMensaje('Evaluación enviada correctamente.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo enviar la evaluación.')
    } finally {
      setEnviando(false)
    }
  }

  async function declararConflicto() {
    if (!evaluacion) return
    if (
      !(await confirmar('Esta acción es irreversible y te retirará del proceso de evaluación.', {
        titulo: 'Declarar conflicto de interés',
        textoConfirmar: 'Declarar conflicto',
        peligroso: true,
      }))
    )
      return
    setDeclarando(true)
    setError('')
    setMensaje('')
    try {
      const actualizado = await evaluacionService.declararConflicto(evaluacion.id)
      setEvaluacion(actualizado)
      setMensaje('Has declarado conflicto de interés. Ya no puedes continuar con esta evaluación.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo declarar el conflicto de interés.')
    } finally {
      setDeclarando(false)
    }
  }

  async function onDescargar(tipo: 'rubrica' | 'dictamen') {
    if (!evaluacion) return
    setError('')
    try {
      const url = tipo === 'rubrica' ? evaluacionService.urlDescargarRubrica(evaluacion.id) : evaluacionService.urlDescargarDictamen(evaluacion.id)
      await descargarArchivo(url, `${tipo}-evaluacion-${evaluacion.id}.pdf`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `No se pudo descargar el ${tipo === 'rubrica' ? 'la rúbrica' : 'el dictamen'}.`)
    }
  }

  if (!Number.isFinite(evaluacionId)) {
    navigate('/evaluador/bandeja', { replace: true })
    return null
  }

  const autorPrincipal = expediente?.autores?.find(a => a.esPrincipal) ?? expediente?.autores?.[0] ?? null

  async function abrirDocumento(doc: DocumentoDto, modo: 'preview' | 'descargar') {
    if (!expediente) return
    try {
      const blob = await expedientesService.descargarDocumento(expediente.id, doc.id, modo)
      const url = URL.createObjectURL(blob)
      if (modo === 'preview') {
        setPreview({ url, mimeType: blob.type, fileName: doc.nombreArchivo })
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = doc.nombreArchivo
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 30000)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el documento.')
    }
  }

  function cerrarPreview() {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  function ContextoExpediente({ variant }: { variant: 'mobile' | 'desktop' }) {
    const cardStyle = variant === 'mobile' ? { padding: '13px 14px' } : { padding: '18px 22px' }
    return (
      <div className="card" style={cardStyle}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Resumen del expediente</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--slate-700)' }}>
          <div>
            <strong>Código:</strong> {expediente?.codigoUnico ?? evaluacion?.expediente?.codigoUnico ?? `Expediente #${evaluacion?.expedienteId}`}
          </div>
          <div>
            <strong>Evaluación:</strong> #{evaluacion?.id}
          </div>
          <div>
            <strong>Título:</strong> {expediente?.tituloProtocolo ?? evaluacion?.expediente?.tituloProtocolo ?? 'Título no disponible'}
          </div>
          {expediente?.facultad && (
            <div>
              <strong>Facultad:</strong> {expediente.facultad}
            </div>
          )}
          {expediente?.tipoTramite && (
            <div>
              <strong>Tipo:</strong> {expediente.tipoTramite}
            </div>
          )}
        </div>
      </div>
    )
  }

  function InvestigadorExpediente({ variant }: { variant: 'mobile' | 'desktop' }) {
    const cardStyle = variant === 'mobile' ? { padding: '13px 14px' } : { padding: '18px 22px' }
    const nombre = expediente?.investigadorNombre ?? autorPrincipal?.apellidosNombres ?? 'No disponible'
    const correo = autorPrincipal?.correo ?? 'No disponible'
    return (
      <div className="card" style={cardStyle}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Investigador del expediente</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--slate-700)' }}>
          <div>
            <strong>Nombre:</strong> {nombre}
          </div>
          <div>
            <strong>Correo:</strong> {correo}
          </div>
        </div>
      </div>
    )
  }

  function DocumentosRevision({ variant }: { variant: 'mobile' | 'desktop' }) {
    const cardStyle = variant === 'mobile' ? { padding: '13px 14px' } : { padding: '18px 22px' }
    return (
      <div className="card" style={cardStyle}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Documentos para revisión</div>
        {documentos.length === 0 && <p className="small muted" style={{ margin: 0 }}>No hay documentos disponibles para este expediente en este momento.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {documentos.map(doc => (
            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {doc.nombreArchivo}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--slate-400)' }}>{doc.tipoDocumento}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, flex: 'none' }}>
                <button className="link" onClick={() => abrirDocumento(doc, 'preview')}>
                  Ver
                </button>
                <button className="link" onClick={() => abrirDocumento(doc, 'descargar')}>
                  Descargar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function ProgresoResultado({ variant }: { variant: 'mobile' | 'desktop' }) {
    if (!rubrica) return null
    const pct = Math.min(100, Math.round((puntajeAcumulado / rubrica.puntajeTotalMax) * 100))
    const colorResultado =
      resultadoPrevisto === 'Aprobado' ? 'var(--success)' : resultadoPrevisto === 'Aprobado con observaciones' ? 'var(--warn)' : 'var(--danger)'
    return (
      <div className="card" style={{ padding: variant === 'mobile' ? '13px 14px' : '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate-700)' }}>Puntaje acumulado</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {puntajeAcumulado} / {rubrica.puntajeTotalMax}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--line-soft)', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: colorResultado, transition: 'width .2s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>Resultado previsto</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: colorResultado }}>{resultadoPrevisto}</span>
        </div>
      </div>
    )
  }

  // Barra del asistente: botón + estado. Se oculta por completo si el servidor
  // no tiene clave configurada.
  function BarraIa({ variant }: { variant: 'mobile' | 'desktop' }) {
    if (!iaDisponible || bloqueado) return null
    const hay = Object.keys(sugerencias).length > 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className={variant === 'mobile' ? 'btn' : 'd-btn-primary'}
          style={{
            background: 'var(--purple)',
            color: '#fff',
            border: 'none',
            width: variant === 'desktop' ? '100%' : undefined,
          }}
          disabled={analizando}
          onClick={() => analizarConIa(hay)}
        >
          {analizando ? 'Leyendo los documentos…' : hay ? '✦ Volver a analizar' : '✦ Analizar con IA'}
        </button>

        {analizando && (
          <p className="small" style={{ margin: 0, color: 'var(--slate-500)' }}>
            Puede tardar hasta un minuto. Mientras tanto puedes llenar la rúbrica a mano.
          </p>
        )}

        {errorIa && <p className="field-error" style={{ margin: 0 }}>{errorIa}</p>}

        {hay && !analizando && (
          <div
            style={{
              background: 'var(--purple-bg)',
              border: '1px solid var(--purple-line)',
              borderRadius: 10,
              padding: '11px 13px',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--purple-ink)', marginBottom: 3 }}>
              ✦ Borrador generado
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--slate-500)', lineHeight: 1.5 }}>
              {pendientesIa.length > 0 ? (
                <>
                  Revisa cada criterio antes de enviar. Quedan{' '}
                  <strong style={{ color: 'var(--purple-ink)' }}>{pendientesIa.length} sin confirmar</strong>.
                </>
              ) : (
                'Revisaste todos los criterios. Ya puedes enviar la evaluación.'
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  function CriteriosForm({ variant }: { variant: 'mobile' | 'desktop' }) {
    if (!rubrica) return null
    const fieldClass = variant === 'mobile' ? 'field' : ''
    const textareaClass = variant === 'mobile' ? 'textarea' : 'd-field d-textarea'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rubrica.criterios.map(c => {
          const sug = sugerencias[c.key]
          const pendiente = !!sug && !confirmados[c.key]
          return (
          <div
            key={c.key}
            className="card"
            style={{
              padding: variant === 'mobile' ? '13px 14px' : '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              ...(pendiente
                ? { borderColor: 'var(--purple-line)', background: 'var(--purple-bg)' }
                : {}),
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <strong style={{ fontSize: 13.5 }}>{c.nombre}</strong>
              {pendiente ? (
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, flex: 'none',
                    background: '#fff', color: 'var(--purple-ink)',
                    border: '1px solid var(--purple-line)',
                    padding: '2px 9px', borderRadius: 20,
                  }}
                >
                  ✦ Sugerido
                </span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-400)', flex: 'none' }}>máx. {c.puntajeMax} pts</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div className={fieldClass} style={{ width: 130 }}>
                {variant === 'mobile' && <label>Puntaje</label>}
                {variant === 'desktop' && <div className="d-field-label">Puntaje</div>}
                {variant === 'mobile' ? (
                  <div className="select-wrap">
                    <select
                      className="select"
                      disabled={bloqueado}
                      value={criteriosEstado[c.key]?.puntaje ?? ''}
                      onChange={e => actualizarCriterio(c.key, 'puntaje', e.target.value)}
                    >
                      <option value="">Selecciona…</option>
                      {Array.from({ length: c.puntajeMax + 1 }, (_, n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    className="d-field"
                    disabled={bloqueado}
                    value={criteriosEstado[c.key]?.puntaje ?? ''}
                    onChange={e => actualizarCriterio(c.key, 'puntaje', e.target.value)}
                  >
                    <option value="">Selecciona…</option>
                    {Array.from({ length: c.puntajeMax + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className={fieldClass}>
              {variant === 'mobile' && <label>Observación (opcional)</label>}
              {variant === 'desktop' && <div className="d-field-label">Observación (opcional)</div>}
              {/* Con una sugerencia sin confirmar el campo crece: la
                  justificación de la IA ocupa varias líneas y, al tamaño
                  normal, quedaba cortada con scroll interno — justo el texto
                  que el evaluador necesita leer entero para decidir. */}
              <textarea
                className={textareaClass}
                style={
                  variant === 'desktop' ? { minHeight: pendiente ? 116 : 64 } : pendiente ? { minHeight: 132 } : undefined
                }
                disabled={bloqueado}
                placeholder="Comentario sobre este criterio…"
                value={criteriosEstado[c.key]?.observacion ?? ''}
                onChange={e => actualizarCriterio(c.key, 'observacion', e.target.value)}
              />
            </div>

            {pendiente && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* La cita es lo que hace verificable la sugerencia: sin ella el
                    evaluador tendría que creerle a la IA o releer todo. */}
                <span
                  style={{
                    fontSize: 11.5, fontFamily: 'ui-monospace, monospace',
                    background: '#fff', color: 'var(--purple-ink)',
                    border: '1px solid var(--purple-line)',
                    padding: '3px 8px', borderRadius: 6,
                  }}
                >
                  {sug.cita}
                </span>
                <button
                  className="btn"
                  style={{ background: 'var(--purple)', color: '#fff', border: 'none', padding: '7px 16px', fontSize: 12.5 }}
                  onClick={() => confirmarCriterio(c.key)}
                >
                  Aceptar
                </button>
              </div>
            )}
          </div>
          )
        })}
      </div>
    )
  }

  function Mensajes() {
    return (
      <>
        {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
        {mensaje && !error && <p className="small" style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>{mensaje}</p>}
      </>
    )
  }

  function Acciones({ variant }: { variant: 'mobile' | 'desktop' }) {
    if (soloLectura) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className={variant === 'mobile' ? 'btn btn-outline' : 'd-btn-ghost'} style={variant === 'desktop' ? { width: '100%' } : undefined} onClick={() => onDescargar('rubrica')}>
            Descargar rúbrica (PDF)
          </button>
          {evaluacion?.resultado && (
            <button className={variant === 'mobile' ? 'btn btn-primary' : 'd-btn-primary'} style={variant === 'desktop' ? { width: '100%' } : undefined} onClick={() => onDescargar('dictamen')}>
              Descargar dictamen (PDF)
            </button>
          )}
        </div>
      )
    }

    if (conflicto) {
      return <p className="small muted">Declaraste conflicto de interés en esta evaluación; ya no puedes editarla.</p>
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className={variant === 'mobile' ? 'btn btn-outline' : 'd-btn-ghost'}
          style={variant === 'desktop' ? { width: '100%' } : undefined}
          disabled={guardando}
          onClick={guardarAvance}
        >
          {guardando ? 'Guardando…' : 'Guardar avance'}
        </button>
        <button
          className={variant === 'mobile' ? 'btn btn-primary' : 'd-btn-primary'}
          style={variant === 'desktop' ? { width: '100%' } : undefined}
          disabled={enviando}
          onClick={enviarEvaluacion}
        >
          {enviando ? 'Enviando…' : 'Enviar evaluación'}
        </button>
        <button
          className={variant === 'mobile' ? 'btn btn-danger-outline' : 'd-btn-danger'}
          style={variant === 'desktop' ? { width: '100%' } : undefined}
          disabled={declarando}
          onClick={declararConflicto}
        >
          {declarando ? 'Declarando…' : 'Declarar conflicto de interés'}
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="mobile-only">
        <TopBar titulo="Evaluación" />
        <div className="screen-body" style={{ padding: '15px 16px 24px', gap: 14 }}>
          {cargando && <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>Cargando evaluación…</p>}
          {errorCarga && <p className="field-error" style={{ textAlign: 'center', margin: '24px 0' }}>{errorCarga}</p>}

          {evaluacion && rubrica && !errorCarga && (
            <>
              <ContextoExpediente variant="mobile" />
              <InvestigadorExpediente variant="mobile" />
              <DocumentosRevision variant="mobile" />
              {iaDisponible && evaluacion && <ConsultaIa expedienteId={evaluacion.expedienteId} />}
              <ProgresoResultado variant="mobile" />

              <BarraIa variant="mobile" />

              <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Criterios de evaluación</strong>
              <CriteriosForm variant="mobile" />

              <div className="field">
                <label>Observaciones generales</label>
                <textarea
                  className="textarea"
                  disabled={bloqueado}
                  placeholder="Comentarios generales sobre el protocolo…"
                  value={observacionesGenerales}
                  onChange={e => setObservacionesGenerales(e.target.value)}
                />
              </div>

              <Mensajes />
              <Acciones variant="mobile" />
            </>
          )}
        </div>
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar
            left={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--slate-400)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }} onClick={() => navigate('/evaluador/bandeja')}>
                  Bandeja de evaluaciones ›
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {evaluacion?.expediente?.codigoUnico ?? `Evaluación #${evaluacionId}`}
                </span>
              </div>
            }
          />
          <div className="d-content">
            {cargando && <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>Cargando evaluación…</p>}
            {errorCarga && <p className="field-error" style={{ textAlign: 'center', margin: '24px 0' }}>{errorCarga}</p>}

            {evaluacion && rubrica && !errorCarga && (
              <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
                <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                  <BarraIa variant="desktop" />

                  <strong style={{ fontSize: 14, color: 'var(--navy)' }}>Criterios de evaluación</strong>
                  <CriteriosForm variant="desktop" />

                  <div className="card" style={{ padding: '18px 22px' }}>
                    <div className="d-field-label">Observaciones generales</div>
                    <textarea
                      className="d-field d-textarea"
                      style={{ minHeight: 96 }}
                      disabled={bloqueado}
                      placeholder="Comentarios generales sobre el protocolo…"
                      value={observacionesGenerales}
                      onChange={e => setObservacionesGenerales(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                  <ContextoExpediente variant="desktop" />
                  <InvestigadorExpediente variant="desktop" />
                  <DocumentosRevision variant="desktop" />
                  {iaDisponible && evaluacion && <ConsultaIa expedienteId={evaluacion.expedienteId} />}
                  <ProgresoResultado variant="desktop" />

                  <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Mensajes />
                    <Acciones variant="desktop" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {preview && <DocumentPreviewModal preview={preview} onClose={cerrarPreview} onDescargar={() => {
        const a = document.createElement('a')
        a.href = preview.url
        a.download = preview.fileName
        a.click()
      }} />}
    </>
  )
}
