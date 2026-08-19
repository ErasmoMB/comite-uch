import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import DocumentPreviewModal, { type DocumentPreviewState } from '../components/DocumentPreviewModal'
import { TopBar, StatusBadge } from '../components/shared'
import { formatearFechaHora } from '../lib/dates'
import { descargarArchivo, hayDictamen, hayRubrica, RESULTADO_LABEL } from '../lib/descargas'
import { ApiError } from '../lib/http'
import { ESTADO_LABEL, toDomainProyecto } from '../lib/mappers'
import { evaluacionService, expedientesService } from '../services'
import type { DocumentoDto, EstadoExpediente, ExpedienteDto, HistorialDto, RequisitosDto } from '../types/api'

const ESTADOS_CAMBIO_TITULO: EstadoExpediente[] = ['aprobado', 'aprobado_observaciones']

export default function DetalleProyecto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const expedienteId = Number(id)

  const [expediente, setExpediente] = useState<ExpedienteDto | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoDto[]>([])
  const [historial, setHistorial] = useState<HistorialDto[]>([])
  const [requisitos, setRequisitos] = useState<RequisitosDto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [accionError, setAccionError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [subiendoTipo, setSubiendoTipo] = useState<string | null>(null)
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null)
  const [descargando, setDescargando] = useState<'rubrica' | 'dictamen' | null>(null)
  const [descargaError, setDescargaError] = useState('')

  async function handleDescargarEvaluacion(tipo: 'rubrica' | 'dictamen', evaluacionId: number) {
    setDescargaError('')
    setDescargando(tipo)
    try {
      const url =
        tipo === 'rubrica'
          ? evaluacionService.urlDescargarRubrica(evaluacionId)
          : evaluacionService.urlDescargarDictamen(evaluacionId)
      await descargarArchivo(url, `${tipo}-${expediente?.codigoUnico ?? evaluacionId}.pdf`)
    } catch (e) {
      setDescargaError(
        e instanceof ApiError ? e.message : `No se pudo descargar ${tipo === 'rubrica' ? 'la rúbrica' : 'el dictamen'}.`,
      )
    } finally {
      setDescargando(null)
    }
  }

  const cargar = useCallback(async () => {
    if (!Number.isFinite(expedienteId)) {
      setNoEncontrado(true)
      setCargando(false)
      return
    }
    setCargando(true)
    try {
      const [detalle, req] = await Promise.all([
        expedientesService.getDetalle(expedienteId),
        expedientesService.getRequisitos(expedienteId).catch(() => null),
      ])
      setExpediente(detalle.expediente)
      setDocumentos(detalle.documentos)
      setHistorial(detalle.historial)
      setRequisitos(req)
    } catch {
      setNoEncontrado(true)
    } finally {
      setCargando(false)
    }
  }, [expedienteId])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (noEncontrado) return <Navigate to="/proyectos" replace />

  if (cargando || !expediente) {
    return (
      <>
        <TopBar titulo="Detalle del proyecto" />
        <div className="screen-body" style={{ padding: '15px 16px 24px' }}>
          <p className="small muted">Cargando proyecto…</p>
        </div>
      </>
    )
  }

  const proyecto = toDomainProyecto(expediente, documentos)

  function descargarBlob(url: string, nombreArchivo: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function abrirDocumento(doc: DocumentoDto, modo: 'preview' | 'descargar') {
    try {
      const blob = await expedientesService.descargarDocumento(expediente!.id, doc.id, modo)
      const url = URL.createObjectURL(blob)
      if (modo === 'preview') {
        setPreview({ url, mimeType: blob.type, fileName: doc.nombreArchivo })
      } else {
        descargarBlob(url, doc.nombreArchivo)
        setTimeout(() => URL.revokeObjectURL(url), 30000)
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'No se pudo abrir el documento.')
    }
  }

  function cerrarPreview() {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  async function subirDocumento(tipo: string, file: File) {
    setSubiendoTipo(tipo)
    setAccionError('')
    try {
      await expedientesService.registrarDocumento(expediente!.id, file, { tipoDocumento: tipo, esObligatorio: true })
      await cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo subir el documento.')
    } finally {
      setSubiendoTipo(null)
    }
  }

  async function handleEnviar() {
    setEnviando(true)
    setAccionError('')
    try {
      await expedientesService.enviar(expediente!.id)
      await cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo enviar el proyecto.')
    } finally {
      setEnviando(false)
    }
  }

  const esBorrador = expediente.estado === 'borrador'
  const puedeCambiarTitulo = ESTADOS_CAMBIO_TITULO.includes(expediente.estado)

  // Filas del checklist: si hay requisitos reales, se arma a partir de los
  // tipos de documento requeridos por la modalidad; si no, se listan
  // simplemente los documentos ya cargados.
  const filasChecklist = requisitos
    ? requisitos.documentosRequeridos.map(req => ({
        tipo: req.tipo,
        nombre: req.label,
        doc: documentos.find(d => d.tipoDocumento === req.tipo) ?? null,
      }))
    : documentos.map(d => ({ tipo: d.tipoDocumento, nombre: d.nombreArchivo, doc: d }))

  function ChecklistRow({ tipo, nombre, doc }: { tipo: string; nombre: string; doc: DocumentoDto | null }) {
    const cargado = !!doc
    return (
      <div className="list-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: cargado ? 'var(--success)' : 'var(--chip-bg)',
              color: cargado ? '#fff' : 'var(--slate-400)',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            {cargado ? '✓' : '–'}
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 'none' }}>
          {cargado && doc ? (
            <>
              <button className="link" onClick={() => abrirDocumento(doc, 'preview')}>
                Ver
              </button>
              <button className="link" onClick={() => abrirDocumento(doc, 'descargar')}>
                Descargar
              </button>
            </>
          ) : esBorrador ? (
            <label className="link" style={{ cursor: subiendoTipo === tipo ? 'wait' : 'pointer' }}>
              {subiendoTipo === tipo ? 'Subiendo…' : 'Subir'}
              <input
                type="file"
                style={{ display: 'none' }}
                disabled={subiendoTipo !== null}
                onChange={e => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) subirDocumento(tipo, file)
                }}
              />
            </label>
          ) : (
            <span className="small muted">Pendiente</span>
          )}
        </div>
      </div>
    )
  }

  function HistorialPanel() {
    return (
      <>
        {historial.length === 0 && <p className="small muted" style={{ margin: 0 }}>Sin movimientos registrados.</p>}
        {historial.map(h => (
          <div key={h.id} style={{ fontSize: 11.5, lineHeight: 1.9, color: 'var(--slate-500)' }}>
            {formatearFechaHora(h.createdAt)} —{' '}
            {ESTADO_LABEL[h.estadoNuevo as keyof typeof ESTADO_LABEL] ?? h.estadoNuevo}
            {h.observaciones ? `: ${h.observaciones}` : ''}
          </div>
        ))}
      </>
    )
  }

  // Resultado de la evaluación del comité: es el desenlace del trámite, así
  // que el solicitante debe poder descargar aquí sus propios PDFs. Qué archivo
  // existe depende del resultado (ver hayDictamen/hayRubrica).
  function ResultadoEvaluacion({ desktop = false }: { desktop?: boolean }) {
    const resultado = expediente!.evaluacionResultado
    const evaluacionId = expediente!.evaluacionId
    if (!resultado || !evaluacionId) return null

    const color =
      resultado === 'aprobado' ? 'var(--success)' : resultado === 'no_aprobado' ? 'var(--danger)' : 'var(--warning)'

    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="small muted">Resultado de la evaluación</span>
          <strong style={{ fontSize: desktop ? 15 : 14.5, color }}>
            {RESULTADO_LABEL[resultado] ?? resultado}
          </strong>
        </div>

        {descargaError && (
          <p className="field-error" style={{ margin: 0 }}>
            {descargaError}
          </p>
        )}

        {hayDictamen(resultado) && (
          <button
            className={desktop ? 'd-btn-primary' : 'btn btn-primary'}
            style={desktop ? { width: '100%' } : undefined}
            disabled={descargando !== null}
            onClick={() => handleDescargarEvaluacion('dictamen', evaluacionId)}
          >
            {descargando === 'dictamen' ? 'Descargando…' : 'Descargar dictamen (PDF)'}
          </button>
        )}
        {hayRubrica(resultado) && (
          <button
            className={desktop ? 'd-btn-ghost' : 'btn btn-outline'}
            style={desktop ? { width: '100%' } : undefined}
            disabled={descargando !== null}
            onClick={() => handleDescargarEvaluacion('rubrica', evaluacionId)}
          >
            {descargando === 'rubrica' ? 'Descargando…' : 'Descargar rúbrica de evaluación (PDF)'}
          </button>
        )}
      </>
    )
  }

  function Acciones({ desktop = false }: { desktop?: boolean }) {
    return (
      <>
        {accionError && (
          <p className="field-error" style={{ margin: 0 }}>
            {accionError}
          </p>
        )}
        {esBorrador && requisitos && !requisitos.completo && (
          <p className="small muted" style={{ margin: 0 }}>
            Falta: {requisitos.faltantes.join(', ')}
          </p>
        )}
        {esBorrador && (
          <button
            className={desktop ? 'd-btn-primary' : 'btn btn-primary'}
            style={desktop ? { width: '100%' } : undefined}
            disabled={enviando}
            onClick={handleEnviar}
          >
            {enviando ? 'Enviando…' : 'Enviar proyecto'}
          </button>
        )}
        {/* Sin esta salida, un borrador con datos incompletos (p. ej. un
            integrante sin teléfono) quedaba trabado: el envío lo rechazaba y
            no había ninguna pantalla para completarlo. */}
        {esBorrador && (
          <button
            className={desktop ? 'd-btn-ghost' : 'btn btn-outline'}
            style={desktop ? { width: '100%' } : undefined}
            onClick={() => navigate(`/proyectos/${expediente!.id}/editar`)}
          >
            Editar datos del proyecto ›
          </button>
        )}
        {expediente!.estado === 'subsanacion' && (
          <button
            className={desktop ? 'd-btn-primary' : 'btn btn-primary'}
            style={desktop ? { width: '100%' } : undefined}
            onClick={() => navigate(`/proyectos/${expediente!.id}/subsanar`)}
          >
            Subsanar observaciones ›
          </button>
        )}
        {puedeCambiarTitulo && (
          <button
            className={desktop ? 'd-btn-ghost' : 'btn btn-outline'}
            style={desktop ? { width: '100%' } : undefined}
            onClick={() => navigate(`/proyectos/${expediente!.id}/titulo`)}
          >
            Solicitar cambio de título ›
          </button>
        )}
      </>
    )
  }

  return (
    <>
      <div className="mobile-only">
      <TopBar titulo="Detalle del proyecto" />
      <div className="screen-body" style={{ padding: '15px 16px 24px', gap: 12 }}>
        <div className="card" style={{ padding: '13px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span className="small" style={{ fontWeight: 600, color: 'var(--slate-400)' }}>
              {proyecto.codigo ?? '—'}
            </span>
            <StatusBadge estado={proyecto.estado} />
          </div>
          <strong style={{ fontSize: 15, lineHeight: 1.35 }}>{proyecto.titulo}</strong>
        </div>

        {expediente.evaluacionResultado && expediente.evaluacionId && (
          <>
            <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Resultado del comité</strong>
            <div className="card" style={{ padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ResultadoEvaluacion />
            </div>
          </>
        )}

        <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Checklist documental</strong>
        <div className="card" style={{ overflow: 'hidden' }}>
          {filasChecklist.map(f => (
            <ChecklistRow key={f.tipo} tipo={f.tipo} nombre={f.nombre} doc={f.doc} />
          ))}
          {filasChecklist.length === 0 && (
            <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
              Aún no se han cargado documentos.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Acciones />
        </div>

        <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Historial</strong>
        <div className="card" style={{ padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <HistorialPanel />
        </div>
      </div>
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar
            left={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--slate-400)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }} onClick={() => navigate('/proyectos')}>
                  Mis proyectos ›
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{proyecto.codigo ?? '—'}</span>
              </div>
            }
          />
          <div className="d-content">
            <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                <div className="card" style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-400)' }}>{proyecto.codigo ?? '—'}</span>
                    <StatusBadge estado={proyecto.estado} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{proyecto.titulo}</div>
                </div>

                <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                    Checklist documental
                  </div>
                  <div className="d-table-body">
                    {filasChecklist.map(f => (
                      <ChecklistRow key={f.tipo} tipo={f.tipo} nombre={f.nombre} doc={f.doc} />
                    ))}
                    {filasChecklist.length === 0 && (
                      <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
                        Aún no se han cargado documentos.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                {expediente.evaluacionResultado && expediente.evaluacionId && (
                  <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }}>Resultado del comité</span>
                    <ResultadoEvaluacion desktop />
                  </div>
                )}

                <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }}>Acciones</span>
                  <Acciones desktop />
                </div>

                <div className="card" style={{ flex: 1, padding: '16px 18px', overflowY: 'auto' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Historial</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <HistorialPanel />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <DocumentPreviewModal
          preview={preview}
          onClose={cerrarPreview}
          onDescargar={() => descargarBlob(preview.url, preview.fileName)}
        />
      )}
    </>
  )
}
