import { useEffect, useRef, useState, type FormEvent } from 'react'
import BottomNav from '../../components/BottomNav'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import { ROL_LABEL } from '../../data/types'
import { formatearFecha } from '../../lib/dates'
import { ApiError } from '../../lib/http'
import { chatService } from '../../services'
import type { ConversacionChatDto, MensajeChatDto, RolBackend, SolicitanteChatDto } from '../../types/api'

function iniciales(nombreCompleto?: string) {
  const partes = (nombreCompleto ?? '').trim().split(/\s+/)
  return `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}`.toUpperCase() || 'U'
}

function formatearHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

// Código + tipo de estudiante debajo del nombre en la lista de conversaciones
// (ej. "Código 2021xxxxx · Estudiante de pregrado"). El investigador no tiene
// código de estudiante, así que en la lista no muestra esta línea (su correo
// se ve en el encabezado del hilo abierto, ver detalleSolicitante).
function subInfoSolicitante(rol: RolBackend, codigoEstudiante: string | null): string {
  if (!codigoEstudiante) return ''
  return `Código ${codigoEstudiante} · ${ROL_LABEL[rol] ?? rol}`
}

// Encabezado del hilo abierto: tipo + código (si aplica) + correo, para
// estudiantes Y para investigador (el correo es lo único que identifica a un
// investigador, ya que no tiene código de estudiante).
function detalleSolicitante(s: { rol: RolBackend; codigoEstudiante: string | null; email: string }): string {
  const partes = [ROL_LABEL[s.rol] ?? s.rol]
  if (s.codigoEstudiante) partes.push(`Código ${s.codigoEstudiante}`)
  partes.push(s.email)
  return partes.join(' · ')
}

export default function Chat() {
  const [conversaciones, setConversaciones] = useState<ConversacionChatDto[]>([])
  const [solicitanteId, setSolicitanteId] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<MensajeChatDto[]>([])
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [solicitantes, setSolicitantes] = useState<SolicitanteChatDto[]>([])
  const [nuevoSeleccionado, setNuevoSeleccionado] = useState<number | ''>('')

  const finRef = useRef<HTMLDivElement>(null)
  const finRefDesktop = useRef<HTMLDivElement>(null)

  async function cargarConversaciones() {
    try {
      const lista = await chatService.getConversaciones()
      setConversaciones(lista)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las conversaciones.')
    }
  }

  // Bandeja de conversaciones: se recarga al montar y cada 10s.
  useEffect(() => {
    cargarConversaciones()
    const t = setInterval(cargarConversaciones, 10000)
    return () => clearInterval(t)
  }, [])

  // Hilo de la conversación seleccionada: recarga inmediata + poll cada 4s.
  useEffect(() => {
    if (solicitanteId === null) {
      setMensajes([])
      return
    }
    let cancelado = false
    async function cargarHilo() {
      try {
        const hilo = await chatService.getHiloDeSolicitante(solicitanteId!)
        if (!cancelado) setMensajes(hilo)
      } catch (err) {
        if (!cancelado) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la conversación.')
      }
    }
    cargarHilo()
    const t = setInterval(cargarHilo, 4000)
    return () => {
      cancelado = true
      clearInterval(t)
    }
  }, [solicitanteId])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
    finRefDesktop.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes.length])

  async function abrirNuevo() {
    setMostrarNuevo(v => !v)
    if (solicitantes.length === 0) {
      try {
        const lista = await chatService.getSolicitantes()
        setSolicitantes(lista)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de solicitantes.')
      }
    }
  }

  function iniciarConversacion() {
    if (nuevoSeleccionado === '') return
    setSolicitanteId(Number(nuevoSeleccionado))
    setMostrarNuevo(false)
    setNuevoSeleccionado('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim() || solicitanteId === null) return
    try {
      setEnviando(true)
      const nuevo = await chatService.enviarComoSecretaria(solicitanteId, texto.trim())
      setMensajes(prev => [...prev, nuevo])
      setTexto('')
      cargarConversaciones()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  const conversacionActiva = conversaciones.find(c => c.solicitanteId === solicitanteId)
  const solicitanteActivo = conversacionActiva ?? solicitantes.find(s => s.id === solicitanteId) ?? null
  const nombreActivo = solicitanteActivo?.nombre ?? ''
  const detalleActivo = solicitanteActivo ? detalleSolicitante(solicitanteActivo) : ''

  const listaConversaciones = (
    <>
      {conversaciones.map(c => (
        <div
          key={c.solicitanteId}
          onClick={() => setSolicitanteId(c.solicitanteId)}
          style={{
            padding: '14px 18px',
            background: c.solicitanteId === solicitanteId ? 'var(--blue-50)' : '#fff',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <div className="avatar" style={{ width: 36, height: 36, background: 'var(--navy)', color: '#fff', fontSize: 12, flex: 'none' }}>
            {iniciales(c.nombre)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.nombre}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--slate-400)', flex: 'none' }}>{formatearFecha(c.ultimaFecha, '')}</span>
            </div>
            {subInfoSolicitante(c.rol, c.codigoEstudiante) && (
              <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {subInfoSolicitante(c.rol, c.codigoEstudiante)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--slate-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.ultimoMensaje ?? 'Sin mensajes'}
              </span>
              {c.noLeidos > 0 && (
                <span
                  style={{
                    flex: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 7px',
                  }}
                >
                  {c.noLeidos}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
      {conversaciones.length === 0 && (
        <p className="muted small" style={{ textAlign: 'center', margin: '24px 16px' }}>
          Aún no hay conversaciones. Usa "+ Nuevo" para escribirle a un solicitante.
        </p>
      )}
    </>
  )

  const panelNuevo = mostrarNuevo && (
    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="select-wrap">
        <select className="select" value={nuevoSeleccionado} onChange={e => setNuevoSeleccionado(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Selecciona un solicitante…</option>
          {solicitantes.map(s => (
            <option key={s.id} value={s.id}>
              {s.nombre} · {detalleSolicitante(s)}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" style={{ height: 38, fontSize: 13 }} onClick={iniciarConversacion} disabled={nuevoSeleccionado === ''}>
        Iniciar conversación
      </button>
    </div>
  )

  const hilo = (
    <>
      {mensajes.map(m => (
        <div key={m.id} className={`bubble ${m.esDeSecretaria ? 'me' : 'them'}`}>
          <div>{m.texto}</div>
          <time>{formatearHora(m.createdAt)}</time>
        </div>
      ))}
      {solicitanteId !== null && mensajes.length === 0 && (
        <p className="muted small" style={{ textAlign: 'center', margin: '24px 0' }}>
          Aún no hay mensajes en esta conversación. Escribe el primero.
        </p>
      )}
    </>
  )

  return (
    <>
      <div className="mobile-only-block screen-body" style={{ background: '#eef2f7', padding: 0 }}>
        {solicitanteId === null ? (
          <>
            <header className="topbar" style={{ justifyContent: 'space-between' }}>
              <h1>Chat</h1>
              <button className="link" onClick={abrirNuevo}>
                + Nuevo
              </button>
            </header>
            {panelNuevo}
            {error && <p className="field-error" style={{ margin: '8px 16px 0' }}>{error}</p>}
            <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>{listaConversaciones}</div>
            <BottomNav />
          </>
        ) : (
          <>
            <header className="topbar" style={{ paddingTop: 10, paddingBottom: 10 }}>
              <button className="back-btn" onClick={() => setSolicitanteId(null)} aria-label="Volver">
                ‹
              </button>
              <div className="avatar" style={{ width: 38, height: 38, background: 'var(--navy)', color: '#fff', fontSize: 12 }}>
                {iniciales(nombreActivo)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{nombreActivo || 'Solicitante'}</div>
                {detalleActivo && (
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--slate-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {detalleActivo}
                  </div>
                )}
              </div>
            </header>
            {error && <p className="field-error" style={{ margin: '8px 16px 0' }}>{error}</p>}
            <div className="chat-body">
              {hilo}
              <div ref={finRef} />
            </div>
            <form
              onSubmit={onSubmit}
              style={{ background: '#fff', borderTop: '1px solid var(--line-soft)', padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <input
                className="input"
                style={{ borderRadius: 999, flex: 1 }}
                placeholder="Escribe un mensaje…"
                value={texto}
                onChange={e => setTexto(e.target.value)}
                disabled={enviando}
              />
              <button
                type="submit"
                aria-label="Enviar mensaje"
                disabled={enviando || !texto.trim()}
                style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flex: 'none', cursor: 'pointer' }}
              >
                ➤
              </button>
            </form>
          </>
        )}
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar
            titulo="Chat"
            extra={
              <button className="d-btn-ghost" onClick={abrirNuevo}>
                + Nuevo
              </button>
            }
          />
          <div className="d-content" style={{ flexDirection: 'row', padding: 0, gap: 0 }}>
            <div style={{ width: 320, flex: 'none', borderRight: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {panelNuevo}
              {error && <p className="field-error" style={{ margin: '8px 18px 0' }}>{error}</p>}
              <div style={{ overflowY: 'auto', flex: 1 }}>{listaConversaciones}</div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#eef2f7' }}>
              {solicitanteId === null ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p className="muted small">Selecciona una conversación o inicia una nueva.</p>
                </div>
              ) : (
                <>
                  <div style={{ minHeight: 60, flex: 'none', background: '#fff', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px' }}>
                    <div className="avatar" style={{ width: 34, height: 34, background: 'var(--navy)', color: '#fff', fontSize: 11, flex: 'none' }}>
                      {iniciales(nombreActivo)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{nombreActivo || 'Solicitante'}</div>
                      {detalleActivo && (
                        <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--slate-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {detalleActivo}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="chat-body" style={{ flex: 1 }}>
                    {hilo}
                    <div ref={finRefDesktop} />
                  </div>
                  <form
                    onSubmit={onSubmit}
                    style={{ background: '#fff', borderTop: '1px solid var(--line-soft)', padding: '14px 22px', display: 'flex', gap: 12, alignItems: 'center' }}
                  >
                    <input
                      className="input"
                      style={{ borderRadius: 999, flex: 1 }}
                      placeholder="Escribe un mensaje…"
                      value={texto}
                      onChange={e => setTexto(e.target.value)}
                      disabled={enviando}
                    />
                    <button
                      type="submit"
                      aria-label="Enviar mensaje"
                      disabled={enviando || !texto.trim()}
                      style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none', cursor: 'pointer' }}
                    >
                      ➤
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
