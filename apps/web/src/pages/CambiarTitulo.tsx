import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { DocumentoCard, type DocEstado } from '../components/DocumentoCard'
import { Stepper, TopBar } from '../components/shared'
import { validarDocumento } from '../lib/documentFormats'
import { ApiError } from '../lib/http'
import { expedientesService } from '../services'
import { useConfirm } from '../state/ConfirmContext'
import type { AutorExpedienteDto, ElegibleCambioTituloDto, TipoDocumentoInfo } from '../types/api'

const PASOS = ['Datos e integrantes', 'Documento', 'Revisar y enviar']
const TITULO_MIN_CARACTERES = 5

interface AutorForm {
  apellidosNombres: string
  codigoEstudiante: string
  correo: string
}

const AUTOR_VACIO: AutorForm = { apellidosNombres: '', codigoEstudiante: '', correo: '' }

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mobile-only">
        <TopBar titulo="Cambiar título" />
        {children}
      </div>
      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Cambiar título" />
          <div className="d-content" style={{ alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: 640 }}>{children}</div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function CambiarTitulo() {
  const navigate = useNavigate()
  const { id } = useParams()
  const idPreseleccionado = Number(id)
  const confirmar = useConfirm()

  const [elegibles, setElegibles] = useState<ElegibleCambioTituloDto[]>([])
  const [programas, setProgramas] = useState<string[]>([])
  const [ciclos, setCiclos] = useState<string[]>([])
  const [modalidad, setModalidad] = useState<string | null>(null)
  const [documentoInfo, setDocumentoInfo] = useState<TipoDocumentoInfo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [origenId, setOrigenId] = useState<number | ''>('')
  const [tituloNuevo, setTituloNuevo] = useState('')
  const [programa, setPrograma] = useState('')
  const [ciclo, setCiclo] = useState('')
  const [autores, setAutores] = useState<AutorForm[]>([AUTOR_VACIO])
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')

  const [paso, setPaso] = useState<'datos' | 'documento' | 'revisar'>('datos')
  const [error, setError] = useState('')
  const [expedienteId, setExpedienteId] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)

  const esInterno = modalidad === 'interno'
  const esEstudiante = !esInterno
  const autorTermCap = esInterno ? 'Coautor' : 'Autor'
  const autorPrincipalLabel = esInterno ? 'Investigador principal' : 'Autor principal'
  const agregarAutorLabel = esInterno ? '+ Agregar coautor' : '+ Agregar autor'

  function aplicarOrigen(e: ElegibleCambioTituloDto) {
    setOrigenId(e.id)
    setTituloNuevo(e.titulo)
    setPrograma(e.programaEstudios || programas[0] || '')
    setCiclo(e.ciclo && ciclos.includes(e.ciclo) ? e.ciclo : ciclos[0] || '')
    setAutores(
      e.autores.length > 0
        ? e.autores.map(a => ({ apellidosNombres: a.apellidosNombres, codigoEstudiante: a.codigoEstudiante, correo: a.correo }))
        : [AUTOR_VACIO],
    )
  }

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const [elegiblesRes, catalogosRes] = await Promise.all([
          expedientesService.getElegiblesCambioTitulo(),
          expedientesService.getCatalogos(),
        ])
        if (!activo) return
        setElegibles(elegiblesRes)
        setProgramas(catalogosRes.programasEstudios ?? [])
        setCiclos(catalogosRes.cambioTitulo?.ciclos ?? [])
        setModalidad(catalogosRes.modalidad)
        setDocumentoInfo(catalogosRes.cambioTitulo?.documento ?? null)
        const preseleccionado = elegiblesRes.find(e => e.id === idPreseleccionado)
        if (preseleccionado) aplicarOrigen(preseleccionado)
      } catch (err) {
        if (activo) setErrorCarga(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos elegibles.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPreseleccionado])

  function onSeleccionarOrigen(valor: string) {
    if (!valor) {
      setOrigenId('')
      return
    }
    const e = elegibles.find(x => x.id === Number(valor))
    if (e) aplicarOrigen(e)
  }

  function actualizarAutor(index: number, campo: keyof AutorForm, valor: string) {
    setAutores(prev => prev.map((a, i) => (i === index ? { ...a, [campo]: valor } : a)))
  }

  function agregarAutor() {
    setAutores(prev => [...prev, { ...AUTOR_VACIO }])
  }

  function quitarAutor(index: number) {
    setAutores(prev => prev.filter((_, i) => i !== index))
  }

  const origen = elegibles.find(e => e.id === origenId) ?? null

  function siguienteDatos() {
    if (origenId === '') {
      setError('Selecciona el proyecto aprobado que deseas modificar.')
      return
    }
    if (tituloNuevo.trim().length < TITULO_MIN_CARACTERES) {
      setError(`Ingresa el nuevo título (mínimo ${TITULO_MIN_CARACTERES} caracteres).`)
      return
    }
    if (!programa || !ciclo) {
      setError('Selecciona el programa y el ciclo.')
      return
    }
    for (let i = 0; i < autores.length; i++) {
      const a = autores[i]
      const etiqueta = i === 0 ? autorPrincipalLabel : `${autorTermCap} ${i + 1}`
      if (!a.apellidosNombres.trim()) return setError(`${etiqueta}: falta apellidos y nombres.`)
      if (esEstudiante && !a.codigoEstudiante.trim()) return setError(`${etiqueta}: falta código de estudiante.`)
      if (!a.correo.trim()) return setError(`${etiqueta}: falta correo.`)
    }
    setError('')
    setPaso('documento')
  }

  function onFileDocumento(f: File) {
    if (!documentoInfo) return
    const err = validarDocumento(f, documentoInfo.tipo)
    if (err) {
      setFileError(err)
      return
    }
    setFileError('')
    setFile(f)
  }

  function siguienteDocumento() {
    if (!file) {
      setError('Selecciona el documento de solicitud de cambio de título.')
      return
    }
    setError('')
    setPaso('revisar')
  }

  async function confirmarEnvio() {
    if (!origen) return
    if (
      !(await confirmar('Se remitirá al Comité de Ética y dejará de ser editable. ¿Deseas enviarla?', {
        titulo: 'Enviar solicitud de cambio de título',
        textoConfirmar: 'Enviar al Comité',
      }))
    )
      return
    setEnviando(true)
    setError('')
    try {
      let expId = expedienteId
      if (!expId) {
        const autoresPayload: AutorExpedienteDto[] = autores.map((a, i) => ({
          orden: i + 1,
          apellidosNombres: a.apellidosNombres.trim(),
          codigoEstudiante: a.codigoEstudiante.trim() || null,
          correo: a.correo.trim() || null,
          telefono: null,
          esPrincipal: i === 0,
        }))
        const nuevo = await expedientesService.createCambioTitulo({
          proyectoOrigenId: origen.id,
          programaEstudios: programa,
          ciclo,
          tituloNuevo: tituloNuevo.trim(),
          autores: autoresPayload,
        })
        expId = nuevo.id
        setExpedienteId(expId)
      }
      if (file && documentoInfo) {
        await expedientesService.registrarDocumento(expId, file, { tipoDocumento: documentoInfo.tipo, esObligatorio: true })
      }
      await expedientesService.enviar(expId)
      navigate(`/proyectos/${expId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud de cambio de título.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <Shell>
        <div className="screen-body" style={{ padding: '15px 16px 24px' }}>
          <p className="small muted">Cargando proyectos elegibles…</p>
        </div>
      </Shell>
    )
  }

  if (errorCarga) {
    return (
      <Shell>
        <div className="screen-body" style={{ padding: '15px 16px 24px' }}>
          <p className="field-error">{errorCarga}</p>
        </div>
      </Shell>
    )
  }

  if (elegibles.length === 0) {
    return (
      <Shell>
        <div className="screen-body" style={{ padding: '15px 16px 24px', gap: 14 }}>
          <p className="small muted" style={{ margin: 0 }}>
            No tienes proyectos aprobados. Solo puedes solicitar un cambio de título sobre un proyecto ya aprobado (con o sin
            observaciones).
          </p>
          <button className="btn btn-outline" onClick={() => navigate('/proyectos')}>
            Volver a mis proyectos
          </button>
        </div>
      </Shell>
    )
  }

  const estadoDocumento: DocEstado = {
    cargado: !!file,
    nombreArchivo: file?.name,
    subiendo: false,
    error: fileError,
  }

  return (
    <Shell>
      <Stepper pasos={PASOS} actual={paso === 'datos' ? 0 : paso === 'documento' ? 1 : 2} />

      {paso === 'datos' && (
        <div className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }}>
          <div className="field">
            <label>Proyecto de origen</label>
            <div className="select-wrap">
              <select className="select" value={origenId} onChange={e => onSeleccionarOrigen(e.target.value)}>
                <option value="">Selecciona tu proyecto…</option>
                {elegibles.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.codigo ?? '—'} · {e.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {origen && (
            <>
              <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 10, padding: '11px 13px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 2 }}>
                  Proyecto aprobado · {origen.codigo ?? '—'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--slate-700)' }}>Título actual: {origen.titulo}</div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Programa</label>
                  <div className="select-wrap">
                    <select className="select" value={programa} onChange={e => setPrograma(e.target.value)}>
                      {programas.map(p => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Ciclo</label>
                  <div className="select-wrap">
                    <select className="select" value={ciclo} onChange={e => setCiclo(e.target.value)}>
                      {ciclos.map(c => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Nuevo título</label>
                <textarea
                  className="textarea"
                  style={{ borderColor: 'var(--primary)', borderWidth: 1.5 }}
                  value={tituloNuevo}
                  onChange={e => setTituloNuevo(e.target.value)}
                  placeholder="Escribe el nuevo título propuesto"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <strong style={{ fontSize: 13.5, color: 'var(--navy)' }}>{esInterno ? 'Coautores' : 'Autores'}</strong>
                <button type="button" className="link" onClick={agregarAutor}>
                  {agregarAutorLabel}
                </button>
              </div>

              {autores.map((a, i) => (
                <div key={i} className="card" style={{ padding: '12px 13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                    <span className="badge badge-blue">{i === 0 ? autorPrincipalLabel : `${autorTermCap} ${i + 1}`}</span>
                    {i > 0 && (
                      <button type="button" className="link" style={{ color: 'var(--danger)' }} onClick={() => quitarAutor(i)}>
                        Quitar
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      className="input"
                      placeholder="Apellidos, nombres"
                      value={a.apellidosNombres}
                      onChange={e => actualizarAutor(i, 'apellidosNombres', e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {esEstudiante && (
                        <input
                          className="input"
                          placeholder="Código"
                          style={{ flex: 1 }}
                          value={a.codigoEstudiante}
                          onChange={e => actualizarAutor(i, 'codigoEstudiante', e.target.value)}
                        />
                      )}
                      <input
                        className="input"
                        placeholder="Correo"
                        style={{ flex: 1 }}
                        value={a.correo}
                        onChange={e => actualizarAutor(i, 'correo', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

          <div className="btn-row" style={{ marginTop: 'auto' }}>
            <button className="btn btn-outline" onClick={() => navigate(-1)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={siguienteDatos}>
              Continuar a documento
            </button>
          </div>
        </div>
      )}

      {paso === 'documento' && documentoInfo && (
        <div className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }}>
          <DocumentoCard doc={documentoInfo} estado={estadoDocumento} disabled={false} onFile={onFileDocumento} />

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

          <div className="btn-row" style={{ marginTop: 'auto' }}>
            <button className="btn btn-outline" onClick={() => setPaso('datos')}>
              Atrás
            </button>
            <button className="btn btn-primary" onClick={siguienteDocumento}>
              Continuar a revisión
            </button>
          </div>
        </div>
      )}

      {paso === 'revisar' && origen && (
        <div className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }}>
          <strong style={{ fontSize: 14, color: 'var(--navy)' }}>Confirma la solicitud de cambio de título</strong>
          <div className="card" style={{ padding: '12px 13px' }}>
            <div className="small muted" style={{ marginBottom: 4 }}>
              Título anterior
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--slate-500)' }}>{origen.titulo}</p>
            <div className="small muted" style={{ marginBottom: 4 }}>
              Nuevo título
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 13.5, fontWeight: 600 }}>{tituloNuevo}</p>
            <div className="small muted" style={{ marginBottom: 4 }}>
              {esInterno ? 'Coautores' : 'Autores'}
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 13 }}>{autores.length}</p>
            <div className="small muted" style={{ marginBottom: 4 }}>
              Documento
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>{file?.name}</p>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Se creará una nueva solicitud vinculada al proyecto {origen.codigo ?? '—'} y se enviará directamente al Comité de
            Ética. No podrás editarla después.
          </p>
          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
          <div className="btn-row" style={{ marginTop: 'auto' }}>
            <button className="btn btn-outline" onClick={() => setPaso('documento')}>
              Atrás
            </button>
            <button className="btn btn-primary" disabled={enviando} onClick={confirmarEnvio}>
              {enviando ? 'Enviando…' : 'Enviar al Comité'}
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}
