import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  // La misma pantalla sirve para crear y para retomar un borrador
  // (`/proyectos/:id/editar`). Antes, apenas se guardaba el borrador los
  // campos quedaban congelados para siempre: si el integrante había quedado
  // sin teléfono, el expediente ya no se podía completar NI enviar.
  const { id } = useParams<{ id: string }>()
  const expedienteIdRuta = id ? Number(id) : null

  const [catalogos, setCatalogos] = useState<CatalogosDto | null>(null)
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)
  const [errorCatalogos, setErrorCatalogos] = useState('')

  const [paso, setPaso] = useState(0)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [creando, setCreando] = useState(false)
  const [enviandoFinal, setEnviandoFinal] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [programa, setPrograma] = useState('')
  const [ciclo, setCiclo] = useState('')
  const [nivelPosgrado, setNivelPosgrado] = useState('')
  // Observación 1 del Comité: tipo de proyecto (artículo / tesis / otro).
  // `tipoProyectoTocado` distingue "todavía no lo eligió nadie" de "el usuario
  // ya decidió": mientras esté en false, cambiar el ciclo vuelve a aplicar la
  // preselección; una vez que el usuario elige, su decisión manda.
  const [tipoProyecto, setTipoProyecto] = useState('')
  const [tipoProyectoTocado, setTipoProyectoTocado] = useState(false)
  const [autores, setAutores] = useState<AutorForm[]>([
    {
      apellidosNombres: usuario ? `${usuario.apellidos}, ${usuario.nombres}` : '',
      codigoEstudiante: usuario?.codigo ?? '',
      correo: usuario?.correo ?? '',
      telefono: '',
    },
  ])

  const [expedienteId, setExpedienteId] = useState<number | null>(expedienteIdRuta)
  const [docsEstado, setDocsEstado] = useState<Record<string, DocEstado>>({})

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const res = await expedientesService.getCatalogos()
        if (!activo) return
        setCatalogos(res)

        if (!expedienteIdRuta) {
          setPrograma(res.programasEstudios?.[0] ?? '')
          setCiclo(res.ciclos?.[0] ?? '')
          setNivelPosgrado(res.nivelesPosgrado?.[0] ?? '')
          return
        }

        // Modo edición: se rellena el formulario con lo que ya está guardado y
        // se marca como cargado todo documento que el borrador ya tenga.
        const [expediente, documentos] = await Promise.all([
          expedientesService.getById(expedienteIdRuta),
          expedientesService.getDocumentos(expedienteIdRuta).catch(() => []),
        ])
        if (!activo) return
        setTitulo(expediente.tituloProtocolo ?? '')
        setPrograma(expediente.programaEstudios || res.programasEstudios?.[0] || '')
        setCiclo(expediente.ciclo || res.ciclos?.[0] || '')
        setNivelPosgrado(expediente.nivelPosgrado || res.nivelesPosgrado?.[0] || '')
        // Un borrador que ya trae tipo de proyecto guardado no debe perderlo
        // porque el efecto de preselección vuelva a correr.
        if (expediente.tipoProyecto) {
          setTipoProyecto(expediente.tipoProyecto)
          setTipoProyectoTocado(true)
        }
        if (expediente.autores && expediente.autores.length > 0) {
          setAutores(
            [...expediente.autores]
              .sort((a, b) => a.orden - b.orden)
              .map(a => ({
                apellidosNombres: a.apellidosNombres ?? '',
                codigoEstudiante: a.codigoEstudiante ?? '',
                correo: a.correo ?? '',
                telefono: a.telefono ?? '',
              })),
          )
        }
        const modalidadExp = expediente.modalidad ?? res.modalidad
        const requeridos = (modalidadExp && res.documentosRequeridos[modalidadExp]) || []
        setDocsEstado(
          Object.fromEntries(
            requeridos.map(d => {
              const doc = documentos.find(x => x.tipoDocumento === d.tipo)
              return [d.tipo, { cargado: !!doc, subiendo: false, nombreArchivo: doc?.nombreArchivo }]
            }),
          ),
        )
      } catch (err) {
        if (activo) setErrorCatalogos(err instanceof ApiError ? err.message : 'No se pudieron cargar los datos.')
      } finally {
        if (activo) setCargandoCatalogos(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [expedienteIdRuta])

  // Observación 1: preselección por ciclo. VII -> artículo, IX -> tesis; los
  // ciclos VIII y X (y quien no tiene ciclo: posgrado e investigadores) no
  // tienen criterio confirmado por el Comité, así que eligen a mano.
  useEffect(() => {
    if (tipoProyectoTocado) return
    const sugerido = catalogos?.tipoProyectoPorCiclo?.[ciclo] ?? ''
    setTipoProyecto(sugerido)
  }, [ciclo, catalogos, tipoProyectoTocado])

  function elegirTipoProyecto(valor: string) {
    setTipoProyecto(valor)
    setTipoProyectoTocado(true)
  }

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
  const coautoresLabel = esInterno ? 'Coautores' : 'Autores adicionales'
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

  function autoresPayload(): AutorExpedienteDto[] {
    return autores.map((a, i) => ({
      orden: i + 1,
      apellidosNombres: a.apellidosNombres.trim(),
      codigoEstudiante: a.codigoEstudiante.trim() || null,
      correo: a.correo.trim() || null,
      telefono: a.telefono.trim() || null,
      esPrincipal: i === 0,
    }))
  }

  /**
   * Guarda el paso 1: crea el borrador la primera vez y lo actualiza en cada
   * guardado posterior. Devuelve `true` si quedó guardado, para que quien lo
   * llame decida si avanza de paso.
   */
  async function guardarDatos(): Promise<boolean> {
    if (titulo.trim().length < TITULO_MIN_CARACTERES) {
      setError(`El título debe tener al menos ${TITULO_MIN_CARACTERES} caracteres.`)
      return false
    }
    if (!autores[0]?.apellidosNombres.trim()) {
      setError(`El ${autorPrincipalLabel.toLowerCase()} necesita apellidos y nombres.`)
      return false
    }
    if (!tipoProyecto) {
      setError('Indica si el proyecto es un artículo, una tesis u otro tipo de trabajo.')
      return false
    }
    setError('')
    setMensaje('')
    setCreando(true)
    try {
      const datos = {
        tituloProtocolo: titulo.trim(),
        tipoProyecto: tipoProyecto || undefined,
        programaEstudios: programa || undefined,
        ciclo: esPregrado ? ciclo : undefined,
        nivelPosgrado: esPostgrado ? nivelPosgrado : undefined,
        autores: autoresPayload(),
      }
      if (expedienteId) {
        await expedientesService.update(expedienteId, datos)
        setMensaje('Datos guardados.')
      } else {
        const nuevo = await expedientesService.create({ ...datos, tipoTramite: 'proyecto_nuevo' })
        setExpedienteId(nuevo.id)
        setDocsEstado(Object.fromEntries(docsRequeridos.map(d => [d.tipo, { cargado: false, subiendo: false }])))
      }
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el borrador.')
      return false
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

  async function siguientePaso1(e: FormEvent) {
    e.preventDefault()
    if (await guardarDatos()) {
      setPaso(1)
    }
  }

  async function enviarDesktop() {
    if (!expedienteId) {
      await guardarDatos()
      return
    }
    // Los datos del formulario pueden haber cambiado desde el último guardado
    // (justamente el caso de "me faltó el teléfono"): se guardan antes de
    // enviar para que la validación de envío mire lo que el usuario ve.
    if (!(await guardarDatos())) return
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

  const tituloPantalla = expedienteIdRuta ? 'Editar borrador' : 'Nuevo proyecto'

  /**
   * Campos de un integrante. El principal y los coautores comparten los
   * mismos campos pero viven en contenedores distintos (ver más abajo): el
   * Comité observó que tener al investigador principal DENTRO de la caja de
   * "Coautores" se prestaba a confusión.
   */
  // Helpers que DEVUELVEN JSX en vez de ser componentes declarados dentro del
  // render: si fueran componentes, React los trataría como un tipo nuevo en
  // cada render y remontaría los <input>, que perderían el foco a cada tecla.
  function camposAutor(index: number, variant: 'mobile' | 'desktop') {
    const a = autores[index]
    if (!a) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          className="input"
          placeholder="Apellidos, nombres"
          value={a.apellidosNombres}
          onChange={e => actualizarAutor(index, 'apellidosNombres', e.target.value)}
        />
        <div style={{ display: variant === 'mobile' ? 'flex' : 'flex', gap: 6 }}>
          {esEstudiante && (
            <input
              className="input"
              placeholder="Código"
              style={{ flex: 1 }}
              value={a.codigoEstudiante}
              onChange={e => actualizarAutor(index, 'codigoEstudiante', e.target.value)}
            />
          )}
          <input
            className="input"
            placeholder="Correo"
            style={{ flex: 1 }}
            value={a.correo}
            onChange={e => actualizarAutor(index, 'correo', e.target.value)}
          />
        </div>
        <input
          className="input"
          placeholder="Teléfono"
          value={a.telefono}
          onChange={e => actualizarAutor(index, 'telefono', e.target.value)}
        />
      </div>
    )
  }

  function bloqueAutores(variant: 'mobile' | 'desktop') {
    const tituloEstilo =
      variant === 'mobile'
        ? { fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }
        : { fontSize: 13, fontWeight: 700, color: 'var(--navy)' }
    return (
      <>
        {/* --- Investigador/Autor principal: contenedor propio --- */}
        <div style={{ marginTop: 4 }}>
          <span style={tituloEstilo}>{autorPrincipalLabel}</span>
        </div>
        <div className="card" style={{ padding: variant === 'mobile' ? '12px 13px' : '12px 14px' }}>
          {camposAutor(0, variant)}
        </div>

        {/* --- Coautores: contenedor aparte, solo integrantes adicionales --- */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={tituloEstilo}>{coautoresLabel}</span>
          <button type="button" className="link" onClick={agregarCoautor}>
            {agregarAutorLabel}
          </button>
        </div>

        {autores.length === 1 && (
          <p className="small muted" style={{ margin: 0 }}>
            {esInterno
              ? 'Aún no agregaste coautores. Si el proyecto es individual, puedes continuar.'
              : 'Aún no agregaste otros autores. Si el proyecto es individual, puedes continuar.'}
          </p>
        )}

        {autores.slice(1).map((_, i) => {
          const index = i + 1
          return (
            <div key={index} className="card" style={{ padding: variant === 'mobile' ? '12px 13px' : '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                <span className="badge badge-blue">{`${autorTermCap} ${index + 1}`}</span>
                <button type="button" className="link" style={{ color: 'var(--danger)' }} onClick={() => quitarCoautor(index)}>
                  Quitar
                </button>
              </div>
              {camposAutor(index, variant)}
            </div>
          )
        })}

        <button type="button" className="upload-dash primary" onClick={agregarCoautor}>
          {agregarAutorLabel}
        </button>
      </>
    )
  }

  return (
    <>
      <div className="mobile-only">
      <TopBar titulo={paso === 1 ? 'Documentos' : tituloPantalla} />
      <Stepper pasos={PASOS} actual={paso} />

      {paso === 0 && (
        <form className="screen-body" style={{ padding: '15px 16px 22px', gap: 12 }} onSubmit={siguientePaso1}>
          <div className="field">
            <label>Título del proyecto</label>
            <textarea
              className="textarea"
              placeholder="Efectos del mindfulness en la ansiedad…"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Programa</label>
              <div className="select-wrap">
                <select className="select" value={programa} onChange={e => setPrograma(e.target.value)}>
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
                  <select className="select" value={ciclo} onChange={e => setCiclo(e.target.value)}>
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
                  <select className="select" value={nivelPosgrado} onChange={e => setNivelPosgrado(e.target.value)}>
                    {catalogos?.nivelesPosgrado.map(n => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="field">
            <label>Tipo de proyecto</label>
            <div className="select-wrap">
              <select className="select" value={tipoProyecto} onChange={e => elegirTipoProyecto(e.target.value)}>
                <option value="">Selecciona…</option>
                {catalogos?.tiposProyecto.map(t => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {bloqueAutores('mobile')}

          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
          {mensaje && !error && (
            <p className="small" style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>
              {mensaje}
            </p>
          )}

          <div className="btn-row" style={{ marginTop: 4 }}>
            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={creando}>
              {creando ? 'Guardando…' : 'Guardar y continuar'}
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
          <DesktopTopbar titulo={tituloPantalla} />
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
                    onChange={e => setTitulo(e.target.value)}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: (esPregrado || esPostgrado) ? '1fr 1fr' : '1fr', gap: 14 }}>
                  <div>
                    <div className="d-field-label">Programa</div>
                    <select className="d-field" value={programa} onChange={e => setPrograma(e.target.value)}>
                      {catalogos?.programasEstudios.map(p => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  {esPregrado && (
                    <div>
                      <div className="d-field-label">Ciclo</div>
                      <select className="d-field" value={ciclo} onChange={e => setCiclo(e.target.value)}>
                        {catalogos?.ciclos.map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {esPostgrado && (
                    <div>
                      <div className="d-field-label">Nivel de posgrado</div>
                      <select className="d-field" value={nivelPosgrado} onChange={e => setNivelPosgrado(e.target.value)}>
                        {catalogos?.nivelesPosgrado.map(n => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <div className="d-field-label">Tipo de proyecto</div>
                  <select className="d-field" value={tipoProyecto} onChange={e => elegirTipoProyecto(e.target.value)}>
                    <option value="">Selecciona…</option>
                    {catalogos?.tiposProyecto.map(t => (
                      <option key={t.valor} value={t.valor}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {bloqueAutores('desktop')}
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
            {mensaje && !error && (
              <p className="small" style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>
                {mensaje}
              </p>
            )}

            <div style={{ height: 76, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--line-soft)', margin: '0 -32px', padding: '0 32px' }}>
              <button className="d-btn-ghost" onClick={() => navigate(-1)}>
                {expedienteId ? 'Ir a mis proyectos' : 'Cancelar'}
              </button>
              {expedienteId && (
                <button className="d-btn-ghost" disabled={creando || enviandoFinal} onClick={() => guardarDatos()}>
                  {creando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              )}
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
