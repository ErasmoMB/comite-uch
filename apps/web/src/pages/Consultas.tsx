import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { ApiError } from '../lib/http'
import { chatService } from '../services'
import { useApp } from '../state/AppContext'
import type { MensajeChatDto } from '../types/api'

const INTERVALO_POLLING = 4000

export default function Consultas() {
  const { usuario } = useApp()
  const navigate = useNavigate()
  const [mensajes, setMensajes] = useState<MensajeChatDto[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const finRef = useRef<HTMLDivElement>(null)
  const finRefDesktop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activo = true
    async function refrescar() {
      try {
        const lista = await chatService.getMiHilo()
        if (activo) setMensajes(lista)
      } catch {
        // si falla un ciclo de polling, se reintenta en el siguiente sin romper la UI
      }
    }
    refrescar()
    const t = setInterval(refrescar, INTERVALO_POLLING)
    return () => {
      activo = false
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
    finRefDesktop.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes.length])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const contenido = texto.trim()
    if (!contenido || enviando) return
    setEnviando(true)
    setError('')
    try {
      const nuevo = await chatService.enviarComoSolicitante(contenido)
      setMensajes(prev => [...prev, nuevo])
      setTexto('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setEnviando(false)
    }
  }

  function esMio(m: MensajeChatDto) {
    return m.esDeSecretaria === undefined ? m.autorId === usuario?.id : !m.esDeSecretaria
  }

  function hora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }

  const ultimoMensaje = mensajes[mensajes.length - 1]

  return (
    <>
    <div className="mobile-only-block screen-body" style={{ background: '#eef2f7' }}>
      <header className="topbar" style={{ paddingTop: 10, paddingBottom: 10 }}>
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">
          ‹
        </button>
        <div className="avatar" style={{ width: 38, height: 38, background: 'var(--navy)', color: '#fff', fontSize: 12 }}>
          ST
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Secretaría técnica</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--success)' }}>En línea</div>
        </div>
      </header>

      <div className="chat-body">
        <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 500, color: 'var(--slate-400)' }}>Hoy</div>
        {mensajes.map(m => (
          <div key={m.id} className={`bubble ${esMio(m) ? 'me' : 'them'}`}>
            <div>{m.texto}</div>
            <time>{hora(m.createdAt)}</time>
          </div>
        ))}
        {mensajes.length === 0 && (
          <p className="small muted" style={{ textAlign: 'center' }}>
            Aún no tienes mensajes con secretaría.
          </p>
        )}
        <div ref={finRef} />
      </div>

      {error && (
        <p className="field-error" style={{ margin: '0 12px' }}>
          {error}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        style={{
          background: '#fff',
          borderTop: '1px solid var(--line-soft)',
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          className="input"
          style={{ borderRadius: 999, flex: 1 }}
          placeholder="Escribe un mensaje…"
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Enviar mensaje"
          disabled={enviando}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            flex: 'none',
            cursor: 'pointer',
          }}
        >
          ➤
        </button>
      </form>
    </div>

    <div className="desktop-shell">
      <DesktopSidebar />
      <div className="d-main">
        <DesktopTopbar titulo="Consultas" />
        <div className="d-content" style={{ flexDirection: 'row', padding: 0, gap: 0 }}>
          <div style={{ width: 300, flex: 'none', borderRight: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line-soft)' }}>
              <div className="d-search" style={{ width: '100%' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span>Buscar…</span>
              </div>
            </div>
            <div style={{ padding: '14px 18px', background: 'var(--blue-50)', borderBottom: '1px solid var(--line-soft)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="avatar" style={{ width: 36, height: 36, background: 'var(--navy)', color: '#fff', fontSize: 11 }}>
                ST
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Secretaría técnica</div>
                <div style={{ fontSize: 11, color: 'var(--slate-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ultimoMensaje?.texto ?? 'Sin mensajes'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#eef2f7' }}>
            <div style={{ height: 60, flex: 'none', background: '#fff', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px' }}>
              <div className="avatar" style={{ width: 34, height: 34, background: 'var(--navy)', color: '#fff', fontSize: 11 }}>
                ST
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Secretaría técnica</div>
                <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--success)' }}>En línea</div>
              </div>
            </div>
            <div className="chat-body" style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 500, color: 'var(--slate-400)' }}>Hoy</div>
              {mensajes.map(m => (
                <div key={m.id} className={`bubble ${esMio(m) ? 'me' : 'them'}`}>
                  <div>{m.texto}</div>
                  <time>{hora(m.createdAt)}</time>
                </div>
              ))}
              {mensajes.length === 0 && (
                <p className="small muted" style={{ textAlign: 'center' }}>
                  Aún no tienes mensajes con secretaría.
                </p>
              )}
              <div ref={finRefDesktop} />
            </div>
            {error && (
              <p className="field-error" style={{ margin: '8px 22px 0' }}>
                {error}
              </p>
            )}
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
              />
              <button
                type="submit"
                aria-label="Enviar mensaje"
                disabled={enviando}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flex: 'none',
                  cursor: 'pointer',
                }}
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
