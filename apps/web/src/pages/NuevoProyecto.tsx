import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { DocumentoCard, GuiaNombresAlerta, type DocEstado } from '../components/DocumentoCard'
import { Stepper, TopBar } from '../components/shared'
import { validarDocumento } from '../lib/documentFormats'
import { ApiError } from '../lib/http'
import { expedientesService } from '../services'
import { useApp } from '../state/AppContext'
import type { AutorExpedienteDto, CatalogosDto } from '../types/api'

const PASOS = ['Datos', 'Docs', 'Enviar']
const TITULO_MIN_CARACTERES = 10

interface AutorForm {
  apellidosNombres: string
  codigoEstudiante: string
  correo: string
  telefono: string
}

export default function NuevoProyecto() {
  const { usuario } = useApp()
  const navigate = useNavigate()

  const [catalogos, setCatalogos] = useState<CatalogosDto | null>(null)
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)
  const [errorCatalogos, setErrorCatalogos] = useState('')

  const [paso, setPaso] = useState(0)
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)
  const [enviandoFinal, setEnviandoFinal] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [programa, setPrograma] = useState('')
  const [ciclo, setCiclo] = useState('')
  const [nivelPosgrado, setNivelPosgrado] = useState('')
  const [autores, setAutores] = useState<AutorForm[]>([
    {
      apellidosNombres: usuario ? `${usuario.apellidos}, ${usuario.nombres}` : '',
      codigoEstudiante: usuario?.codigo ?? '',
      correo: usuario?.correo ?? '',
      telefono: '',
    },
  ])

  const [expedienteId, setExpedienteId] = useState<number | null>(null)
  const [docsEstado, setDocsEstado] = useState<Record<string, DocEstado>>({})

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const res = await expedientesService.getCatalogos()
        if (!activo) return
        setCatalogos(res)
        setPrograma(res.programasEstudios?.[0] ?? '')
        setCiclo(res.ciclos?.[0] ?? '')
        setNivelPosgrado(res.nivelesPosgrado?.[0] ?? '')
      } catch (err) {
        if (activo) setErrorCatalogos(err instanceof ApiError ? err.message : 'No se pudieron cargar los catálogos.')
      } finally {
        if (activo) setCargandoCatalogos(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [])

  const modalidad = catalogos?.modalidad ?? null
  const esPregrado = modalidad === 'pregrado'
  const esPostgrado = modalidad === 'postgrado'
  const esInterno = modalidad === 'interno'
  const esEstudiante = esPregrado || esPostgrado
  const docsRequeridos = (modalidad && catalogos?.documentosRequeridos[modalidad]) || []

  // El Comité diferencia: estudiantes suman "autores"; investigadores, "coautores"
  // (mismo criterio que el frontend de referencia).
  const autorTermCap = esInterno ? 'Coautor' : 'Autor'
  const autorPrincipalLabel = esInterno ? 'Investigador principal' : 'Autor principal'
  const agregarAutorLabel = esInterno ? '+ Agregar coautor' : '+ Agregar autor'

  function actualizarAutor(index: number, campo: keyof AutorForm, valor: string) {
    setAutores(prev => prev.map((a, i) => (i === index ? { ...a, [campo]: valor } : a)))
  }

  function agregarCoautor() {
    setAutores(prev => [...prev, { apellidosNombres: '', codigoEstudiante: '', correo: '', telefono: '' }])
  }

  function quitarCoautor(index: number) {
    setAutores(prev => prev.filter((_, i) => i !== index))
  }

  async function crearBorrador() {
    if (titulo.trim().length < TITULO_MIN_CARACTERES) {
      setError(`El título debe tener al menos ${TITULO_MIN_CARACTERES} caracteres.`)
      return
    }
    if (!autores[0]?.apellidosNombres.trim()) {
      setError(`El ${autorPrincipalLabel.toLowerCase()} necesita apellidos y nombres.`)
      return
    }
    setError('')
    setCreando(true)
    try {
      const autoresPayload: AutorExpedienteDto[] = autores.map((a, i) => ({
        orden: i + 1,
        apellidosNombres: a.apellidosNombres.trim(),
        codigoEstudiante: a.codigoEstudiante.trim() || null,
        correo: a.correo.trim() || null,
        telefono: a.telefono.trim() || null,
        esPrincipal: i === 0,
      }))
      const nuevo = await expedientesService.create({
        tituloProtocolo: titulo.trim(),
        tipoTramite: 'proyecto_nuevo',
        programaEstudios: programa || undefined,
        ciclo: esPregrado ? ciclo : undefined,
        nivelPosgrado: esPostgrado ? nivelPosgrado : undefined,
        autores: autoresPayload,
      })
      setExpedienteId(nuevo.id)
      setDocsEstado(Object.fromEntries(docsRequeridos.map(d => [d.tipo, { cargado: false, subiendo: false }])))
      setPaso(1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el borrador.')
    } finally {
      setCreando(false)
    }
  }

  async function subirDocumento(tipo: string, file: File) {
    if (!expedienteId) return
    const errorValidacion = validarDocumento(file, tipo)
    if (errorValidacion) {
      setDocsEstado(prev => ({ ...prev, [tipo]: { ...prev[tipo], error: errorValidacion } }))
      return
    }
    setDocsEstado(prev => ({ ...prev, [tipo]: { ...prev[tipo], subiendo: true, error: undefined } }))
    try {
      const doc = await expedientesService.registrarDocumento(expedienteId, file, { tipoDocumento: tipo, esObligatorio: true })
      setDocsEstado(prev => ({ ...prev, [tipo]: { cargado: true, nombreArchivo: doc.nombreArchivo, subiendo: false } }))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo subir el documento.'
      setDocsEstado(prev => ({ ...prev, [tipo]: { ...prev[tipo], subiendo: false, error: msg } }))
    }
  }

  const todosCargados = docsRequeridos.length > 0 && docsRequeridos.every(d => docsEstado[d.tipo]?.cargado)

  function siguientePaso2() {
    if (!todosCargados) {
      setError('Faltan documentos por cargar antes de continuar.')
      return
    }
    setError('')
    setPaso(2)
  }

  async function enviarFinal() {
    if (!expedienteId) return
    setEnviandoFinal(true)
    setError('')
    try {
      const res = await expedientesService.enviar(expedienteId)
      navigate('/nuevo/exito', { state: { codigo: res.codigo, id: expedienteId } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el proyecto.')
    } finally {
      setEnviandoFinal(false)
    }
  }

  function siguientePaso1(e: FormEvent) {
    e.preventDefault()
    if (expedienteId) {
      setPaso(1)
      return
    }
    crearBorrador()
  }

  async function enviarDesktop() {
    if (!expedienteId) {
      await crearBorrador()
      return
    }
    if (!todosCargados) {
      setError('Faltan documentos por cargar antes de enviar.')
      return
    }
    await enviarFinal()
  }

  if (cargandoCatalogos) {
    return (
      <>
        <TopBar titulo="Nuevo proyecto" />
        <div className="screen-body" style={{ padding: '15px 16px 24px' }}>
          <p className="small muted">Cargando…</p>
        </div>
      </>
    )
  }

  if (errorCatalogos) {
    return (
      <>
        <TopBar titulo="Nuevo proyecto" />
        <div className="screen-body" style={{ padding: '15px 16px 24px' }}>
          <p className="field-error">{errorCatalogos}</p>
        </div>
      </>
    )
  }

  if (!modalidad) {
    return (
      <>
        <TopBar titulo="Nuevo proyecto" />
        <div className="screen-body" style={{ padding: '15px 16px 24px' }}>
          <p className="small muted">Tu rol no puede enviar proyectos al comité de ética.</p>
        </div>
      </>
    )
  }

  const datosBloqueados = !!expedienteId

  return (
    <>
      <div className="mobile-only">
      <TopBar titulo={paso === 1 ? 'Documentos' : 'Nuevo proyecto'} />
      <Stepper pasos={PASOS} actual={paso} />

      {paso === 0 && (
        <form className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }} onSubmit={siguientePaso1}>
          <div className="field">
            <label>Título del proyecto</label>
            <textarea
              className="textarea"
              placeholder="Efectos del mindfulness en la ansiedad…"
              value={titulo}
              disabled={datosBloqueados}
              onChange={e => setTitulo(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Programa</label>
              <div className="select-wrap">
                <select className="select" value={programa} disabled={datosBloqueados} onChange={e => setPrograma(e.target.value)}>
                  {catalogos?.programasEstudios.map(p => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            {esPregrado && (
              <div className="field" style={{ flex: 1 }}>
                <label>Ciclo</label>
                <div className="select-wrap">
                  <select className="select" value={ciclo} disabled={datosBloqueados} onChange={e => setCiclo(e.target.value)}>
                    {catalogos?.ciclos.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {esPostgrado && (
              <div className="field" style={{ flex: 1 }}>
                <label>Nivel de posgrado</label>
                <div className="select-wrap">
                  <select className="select" value={nivelPosgrado} disabled={datosBloqueados} onChange={e => setNivelPosgrado(e.target.value)}>
                    {catalogos?.nivelesPosgrado.map(n => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <strong style={{ fontSize: 13.5, color: 'var(--navy)' }}>{esInterno ? 'Coautores' : 'Autores'}</strong>
            {!datosBloqueados && (
              <button type="button" className="link" onClick={agregarCoautor}>
                {agregarAutorLabel}
              </button>
            )}
          </div>

          {autores.map((a, i) => (
            <div key={i} className="card" style={{ padding: '12px 13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                <span className="badge badge-blue">{i === 0 ? autorPrincipalLabel : `${autorTermCap} ${i + 1}`}</span>
                {i > 0 && !datosBloqueados && (
                  <button type="button" className="link" style={{ color: 'var(--danger)' }} onClick={() => quitarCoautor(i)}>
                    Quitar
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  className="input"
                  placeholder="Apellidos, nombres"
                  value={a.apellidosNombres}
                  disabled={datosBloqueados}
                  onChange={e => actualizarAutor(i, 'apellidosNombres', e.target.value)}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  {esEstudiante && (
                    <input
                      className="input"
                      placeholder="Código"
                      style={{ flex: 1 }}
                      value={a.codigoEstudiante}
                      disabled={datosBloqueados}
                      onChange={e => actualizarAutor(i, 'codigoEstudiante', e.target.value)}
                    />
                  )}
                  <input
                    className="input"
                    placeholder="Correo"
                    style={{ flex: 1 }}
                    value={a.correo}
                    disabled={datosBloqueados}
                    onChange={e => actualizarAutor(i, 'correo', e.target.value)}
                  />
                </div>
                <input
                  className="input"
                  placeholder="Teléfono"
                  value={a.telefono}
                  disabled={datosBloqueados}
                  onChange={e => actualizarAutor(i, 'telefono', e.target.value)}
                />
              </div>
            </div>
          ))}

          {!datosBloqueados && (
            <button type="button" className="upload-dash primary" onClick={agregarCoautor}>
              {agregarAutorLabel}
            </button>
          )}

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

          <div className="btn-row" style={{ marginTop: 4 }}>
            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={creando}>
              {creando ? 'Guardando…' : 'Siguiente'}
            </button>
          </div>
        </form>
      )}

      {paso === 1 && (
        <div className="screen-body" style={{ padding: '13px 16px 22px', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13, color: 'var(--navy)' }}>Documentos requeridos</strong>
          </div>

          {catalogos?.guiaNombres && <GuiaNombresAlerta guia={catalogos.guiaNombres} />}

          {docsRequeridos.map(d => (
            <DocumentoCard
              key={d.tipo}
              doc={d}
              estado={docsEstado[d.tipo]}
              disabled={!!docsEstado[d.tipo]?.subiendo}
              onFile={file => subirDocumento(d.tipo, file)}
            />
          ))}

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

          <div className="btn-row" style={{ marginTop: 4 }}>
            <button className="btn btn-outline" onClick={() => setPaso(0)}>
              Atrás
            </button>
            <button className="btn btn-primary" onClick={siguientePaso2}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }}>
          <div className="card" style={{ padding: '13px 14px' }}>
            <div className="small muted" style={{ marginBottom: 4 }}>
              Revisa antes de enviar
            </div>
            <strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>{titulo}</strong>
            <div className="small muted">
              {esPregrado && `${programa} · Ciclo ${ciclo}`}
              {esPostgrado && `${programa} · ${nivelPosgrado}`}
              {!esPregrado && !esPostgrado && programa}
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            {docsRequeridos.map(d => {
              const cargado = !!docsEstado[d.tipo]?.cargado
              return (
                <div key={d.tipo} className="list-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      }}
                    >
                      {cargado ? '✓' : '–'}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{d.label}</span>
                  </div>
                  <span className={`badge ${cargado ? 'badge-aprobado' : 'badge-borrador'}`}>{cargado ? 'Listo' : 'Pendiente'}</span>
                </div>
              )
            })}
          </div>

          <p className="small muted" style={{ margin: 0 }}>
            Al enviar, tu proyecto pasará a revisión administrativa y recibirás notificaciones sobre su avance.
          </p>

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

          <div className="btn-row" style={{ marginTop: 4 }}>
            <button className="btn btn-outline" onClick={() => setPaso(1)}>
              Atrás
            </button>
            <button className="btn btn-primary" disabled={enviandoFinal} onClick={enviarFinal}>
              {enviandoFinal ? 'Enviando…' : 'Enviar proyecto'}
            </button>
          </div>
        </div>
      )}
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Nuevo proyecto" />
          <div className="d-content" style={{ paddingBottom: 0 }}>
            <div style={{ display: 'flex', gap: 22, flex: 1, minHeight: 0 }}>
              <div className="card" style={{ flex: 1.4, padding: '22px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>1 · Datos del proyecto</div>
                <div>
                  <div className="d-field-label">Título del proyecto</div>
                  <textarea
                    className="d-field d-textarea"
                    placeholder="Efectos del mindfulness en la ansiedad…"
                    value={titulo}
                    disabled={datosBloqueados}
                    onChange={e => setTitulo(e.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: (esPregrado || esPostgrado) ? '1fr 1fr' : '1fr', gap: 14 }}>
                  <div>
                    <div className="d-field-label">Programa</div>
                    <select className="d-field" value={programa} disabled={datosBloqueados} onChange={e => setPrograma(e.target.value)}>
                      {catalogos?.programasEstudios.map(p => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  {esPregrado && (
                    <div>
                      <div className="d-field-label">Ciclo</div>
                      <select className="d-field" value={ciclo} disabled={datosBloqueados} onChange={e => setCiclo(e.target.value)}>
                        {catalogos?.ciclos.map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {esPostgrado && (
                    <div>
                      <div className="d-field-label">Nivel de posgrado</div>
                      <select className="d-field" value={nivelPosgrado} disabled={datosBloqueados} onChange={e => setNivelPosgrado(e.target.value)}>
                        {catalogos?.nivelesPosgrado.map(n => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{esInterno ? 'Coautores' : 'Autores'}</span>
                  {!datosBloqueados && (
                    <button className="link" onClick={agregarCoautor}>
                      {agregarAutorLabel}
                    </button>
                  )}
                </div>
                {autores.map((a, i) => (
                  <div key={i} className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                      <span className="badge badge-blue">{i === 0 ? autorPrincipalLabel : `${autorTermCap} ${i + 1}`}</span>
                      {i > 0 && !datosBloqueados && (
                        <button className="link" style={{ color: 'var(--danger)' }} onClick={() => quitarCoautor(i)}>
                          Quitar
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        className="input"
                        placeholder="Apellidos, nombres"
                        value={a.apellidosNombres}
                        disabled={datosBloqueados}
                        onChange={e => actualizarAutor(i, 'apellidosNombres', e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        {esEstudiante && (
                          <input
                            className="input"
                            placeholder="Código"
                            style={{ flex: 1 }}
                            value={a.codigoEstudiante}
                            disabled={datosBloqueados}
                            onChange={e => actualizarAutor(i, 'codigoEstudiante', e.target.value)}
                          />
                        )}
                        <input
                          className="input"
                          placeholder="Correo"
                          style={{ flex: 1 }}
                          value={a.correo}
                          disabled={datosBloqueados}
                          onChange={e => actualizarAutor(i, 'correo', e.target.value)}
                        />
                      </div>
                      <input
                        className="input"
                        placeholder="Teléfono"
                        value={a.telefono}
                        disabled={datosBloqueados}
                        onChange={e => actualizarAutor(i, 'telefono', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                {!datosBloqueados && (
                  <button type="button" className="upload-dash primary" onClick={agregarCoautor}>
                    {agregarAutorLabel}
                  </button>
                )}
              </div>

              <div className="card" style={{ flex: 1, padding: '22px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, opacity: expedienteId ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>2 · Documentos</span>
                </div>
                {!expedienteId && <p className="small muted">Guarda los datos del proyecto para habilitar la carga de documentos.</p>}
                {expedienteId && catalogos?.guiaNombres && <GuiaNombresAlerta guia={catalogos.guiaNombres} />}
                {docsRequeridos.map(d => (
                  <DocumentoCard
                    key={d.tipo}
                    doc={d}
                    estado={docsEstado[d.tipo]}
                    disabled={!expedienteId || !!docsEstado[d.tipo]?.subiendo}
                    onFile={file => subirDocumento(d.tipo, file)}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="field-error" style={{ margin: 0 }}>
                {error}
              </p>
            )}

            <div style={{ height: 76, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--line-soft)', margin: '0 -32px', padding: '0 32px' }}>
              <button className="d-btn-ghost" onClick={() => navigate(-1)}>
                {expedienteId ? 'Ir a mis proyectos' : 'Cancelar'}
              </button>
              <button className="d-btn-primary" style={{ width: 180 }} disabled={creando || enviandoFinal} onClick={enviarDesktop}>
                {!expedienteId ? (creando ? 'Guardando…' : 'Guardar y continuar') : enviandoFinal ? 'Enviando…' : 'Enviar proyecto'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
