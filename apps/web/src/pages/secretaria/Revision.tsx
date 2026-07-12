import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import DocumentPreviewModal, { type DocumentPreviewState } from '../../components/DocumentPreviewModal'
import { StatusBadge, TopBar } from '../../components/shared'
import { formatearFechaHora } from '../../lib/dates'
import { ApiError } from '../../lib/http'
import { expedientesService } from '../../services'
import { useConfirm } from '../../state/ConfirmContext'
import type { BitacoraDto, DocumentoDto, ExpedienteDto, HistorialDto } from '../../types/api'

interface Detalle {
  expediente: ExpedienteDto
  bitacora: BitacoraDto[]
  historial: HistorialDto[]
  documentos: DocumentoDto[]
}

export default function Revision() {
  const { id } = useParams()
  const expedienteId = Number(id)
  const navigate = useNavigate()
  const confirmar = useConfirm()

  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [accionEnCurso, setAccionEnCurso] = useState<'admitir' | 'devolver' | null>(null)
  const [descargando, setDescargando] = useState<number | null>(null)
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      try {
        setCargando(true)
        const data = await expedientesService.getDetalle(expedienteId)
        if (cancelado) return
        setDetalle(data)
        setError('')
      } catch (err) {
        if (cancelado) return
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el expediente.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (!Number.isNaN(expedienteId)) cargar()
    return () => {
      cancelado = true
    }
  }, [expedienteId])

  async function handleDescargar(doc: DocumentoDto) {
    try {
      setDescargando(doc.id)
      const blob = await expedientesService.descargarDocumento(expedienteId, doc.id, 'descargar')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.nombreArchivo
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo descargar el documento.')
    } finally {
      setDescargando(null)
    }
  }

  async function handlePrevisualizar(doc: DocumentoDto) {
    try {
      setDescargando(doc.id)
      const blob = await expedientesService.descargarDocumento(expedienteId, doc.id, 'preview')
      const url = URL.createObjectURL(blob)
      setPreview({ url, mimeType: blob.type, fileName: doc.nombreArchivo })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir el documento.')
    } finally {
      setDescargando(null)
    }
  }

  function cerrarPreview() {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  function descargarDesdePreview() {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview.url
    a.download = preview.fileName
    a.click()
  }

  async function handleAdmitir() {
    if (!(await confirmar('¿Admitir este expediente y pasarlo a revisión de fondo?', { titulo: 'Admitir expediente', textoConfirmar: 'Admitir' }))) return
    try {
      setAccionEnCurso('admitir')
      await expedientesService.update(expedienteId, { estado: 'en_revision' })
      navigate('/secretaria/bandeja')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo admitir el expediente.')
    } finally {
      setAccionEnCurso(null)
    }
  }

  async function handleDevolver() {
    if (!observaciones.trim()) {
      setError('Describe las observaciones para el investigador antes de devolver el expediente.')
      return
    }
    if (!(await confirmar('¿Devolver este expediente al investigador para subsanación?', { titulo: 'Devolver para subsanación', textoConfirmar: 'Devolver' }))) return
    try {
      setAccionEnCurso('devolver')
      // Nota: el backend actual (PUT /expedientes/:id) no persiste el texto de
      // observaciones en un campo propio del expediente — es una limitación
      // conocida. Igual se solicita el texto porque el flujo esperado por la
      // secretaría siempre incluye una justificación de la subsanación.
      await expedientesService.update(expedienteId, { estado: 'subsanacion' })
      navigate('/secretaria/bandeja')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo devolver el expediente para subsanación.')
    } finally {
      setAccionEnCurso(null)
    }
  }

  if (cargando) {
    return (
      <>
        <div className="mobile-only">
          <TopBar titulo="Revisión de expediente" />
          <div className="screen-body" style={{ padding: 16 }}>
            <p className="small muted">Cargando…</p>
          </div>
        </div>
        <div className="desktop-shell">
          <DesktopSidebar />
          <div className="d-main">
            <DesktopTopbar titulo="Revisión de expediente" />
            <div className="d-content">
              <p className="small muted">Cargando…</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!detalle) {
    return (
      <>
        <div className="mobile-only">
          <TopBar titulo="Revisión de expediente" />
          <div className="screen-body" style={{ padding: 16 }}>
            <p className="field-error">{error || 'Expediente no encontrado.'}</p>
          </div>
        </div>
        <div className="desktop-shell">
          <DesktopSidebar />
          <div className="d-main">
            <DesktopTopbar titulo="Revisión de expediente" />
            <div className="d-content">
              <p className="field-error">{error || 'Expediente no encontrado.'}</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  const { expediente, bitacora, historial, documentos } = detalle
  const cargandoAccion = accionEnCurso !== null

  const documentosBloque = (
    <>
      {documentos.map(d => (
        <div key={d.id} className="list-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{d.nombreArchivo}</div>
            <div className="small" style={{ color: 'var(--slate-400)' }}>{d.tipoDocumento}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, flex: 'none' }}>
            <button className="link" disabled={descargando === d.id} onClick={() => handlePrevisualizar(d)}>
              Ver
            </button>
            <button className="link" disabled={descargando === d.id} onClick={() => handleDescargar(d)}>
              {descargando === d.id ? 'Descargando…' : 'Descargar'}
            </button>
          </div>
        </div>
      ))}
      {documentos.length === 0 && (
        <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
          Este expediente no tiene documentos cargados.
        </p>
      )}
    </>
  )

  const autoresBloque = (
    <>
      {(expediente.autores ?? []).map((a, i) => (
        <div key={a.id ?? i} className="list-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{a.apellidosNombres}</div>
            <div className="small" style={{ color: 'var(--slate-400)' }}>
              {a.esPrincipal ? 'Autor principal' : 'Coautor'} · {a.correo ?? '—'}
            </div>
          </div>
        </div>
      ))}
      {(expediente.autores ?? []).length === 0 && (
        <p className="small muted" style={{ padding: '13px 14px', margin: 0 }}>
          Sin autores registrados.
        </p>
      )}
    </>
  )

  const historialBloque = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {historial.map(h => (
        <div key={h.id} style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--slate-500)' }}>
          <strong style={{ color: 'var(--ink)' }}>{formatearFechaHora(h.createdAt)}</strong> — {h.estadoAnterior ?? '—'} → {h.estadoNuevo}
          {h.observaciones && <div style={{ color: 'var(--slate-500)' }}>{h.observaciones}</div>}
        </div>
      ))}
      {bitacora.map(b => (
        <div key={`b-${b.id}`} style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--slate-500)' }}>
          <strong style={{ color: 'var(--ink)' }}>{formatearFechaHora(b.createdAt)}</strong> — {b.accion}
          {b.detalle && <div style={{ color: 'var(--slate-500)' }}>{b.detalle}</div>}
        </div>
      ))}
      {historial.length === 0 && bitacora.length === 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          Sin movimientos registrados.
        </p>
      )}
    </div>
  )

  return (
    <>
      <div className="mobile-only">
        <TopBar titulo="Revisión de expediente" />
        <div className="screen-body" style={{ padding: '15px 16px 24px', gap: 12 }}>
          <div className="card" style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span className="small" style={{ fontWeight: 600, color: 'var(--slate-400)' }}>
                {expediente.codigoUnico ?? '—'}
              </span>
              <StatusBadge estado={expediente.estado} />
            </div>
            <strong style={{ fontSize: 15, lineHeight: 1.35 }}>{expediente.tituloProtocolo}</strong>
          </div>

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

          <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Autores</strong>
          <div className="card" style={{ overflow: 'hidden' }}>{autoresBloque}</div>

          <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Documentos</strong>
          <div className="card" style={{ overflow: 'hidden' }}>{documentosBloque}</div>

          <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Bitácora / historial</strong>
          <div className="card" style={{ padding: '13px 14px' }}>{historialBloque}</div>

          <div className="field">
            <label>Observaciones para subsanación</label>
            <textarea
              className="textarea"
              placeholder="Describe qué debe corregir o completar el investigador…"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
            />
          </div>

          <div className="btn-row">
            <button className="btn btn-outline" disabled={cargandoAccion} onClick={handleDevolver}>
              {accionEnCurso === 'devolver' ? 'Enviando…' : 'Devolver para subsanar'}
            </button>
            <button className="btn btn-primary" disabled={cargandoAccion} onClick={handleAdmitir}>
              {accionEnCurso === 'admitir' ? 'Admitiendo…' : 'Admitir expediente'}
            </button>
          </div>
        </div>
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar
            left={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--slate-400)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }} onClick={() => navigate('/secretaria/bandeja')}>
                  Bandeja ›
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{expediente.codigoUnico ?? '—'}</span>
              </div>
            }
          />
          <div className="d-content">
            {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                <div className="card" style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-400)' }}>{expediente.codigoUnico ?? '—'}</span>
                    <StatusBadge estado={expediente.estado} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{expediente.tituloProtocolo}</div>
                </div>

                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                    Autores
                  </div>
                  {autoresBloque}
                </div>

                <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                    Documentos
                  </div>
                  <div className="d-table-body">{documentosBloque}</div>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                <div className="card" style={{ flex: 1, padding: '16px 18px', overflowY: 'auto' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Bitácora / historial</div>
                  {historialBloque}
                </div>

                <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Acción administrativa</span>
                  <div>
                    <div className="d-field-label">Observaciones para subsanación</div>
                    <textarea
                      className="d-field d-textarea"
                      placeholder="Describe qué debe corregir o completar el investigador…"
                      value={observaciones}
                      onChange={e => setObservaciones(e.target.value)}
                    />
                  </div>
                  <button className="d-btn-ghost" disabled={cargandoAccion} onClick={handleDevolver}>
                    {accionEnCurso === 'devolver' ? 'Enviando…' : 'Devolver para subsanar'}
                  </button>
                  <button className="d-btn-primary" disabled={cargandoAccion} onClick={handleAdmitir}>
                    {accionEnCurso === 'admitir' ? 'Admitiendo…' : 'Admitir expediente'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {preview && <DocumentPreviewModal preview={preview} onClose={cerrarPreview} onDescargar={descargarDesdePreview} />}
    </>
  )
}
