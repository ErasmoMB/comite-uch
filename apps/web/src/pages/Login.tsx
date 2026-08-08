import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/shared'
import { homePathForRole } from '../data/types'
import { ApiError } from '../lib/http'
import { APP_NOMBRE, MOSTRAR_LOGO, URL_COMITE_UCH } from '../lib/marca'
import { useApp } from '../state/AppContext'

export default function Login() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!correo.trim() || !clave) {
      setError('Ingresa tu correo institucional y contraseña.')
      return
    }
    setError('')
    setEnviando(true)
    try {
      const usuario = await login(correo.trim(), clave)
      navigate(homePathForRole(usuario.rol))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div
        className="mobile-only-block screen-body"
        style={{
          // Foto del campus con velo oscuro encima: sin él, el texto y el
          // formulario se pierden sobre el cielo y la fachada blanca.
          backgroundImage:
            'linear-gradient(160deg, rgba(8,32,74,.93), rgba(8,32,74,.78)), url(/uch-campus.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 22px' }}>
          <form
            onSubmit={onSubmit}
            style={{ background: '#fff', borderRadius: 20, padding: '30px 22px', boxShadow: '0 22px 44px rgba(8,32,74,.4)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <Logo />
              <strong style={{ fontSize: 16, lineHeight: 1.35, color: 'var(--navy)', textAlign: 'center' }}>
                {APP_NOMBRE}
              </strong>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="correo">Correo institucional</label>
              <input
                id="correo"
                className="input"
                type="email"
                placeholder="usuario@uch.pe"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="field" style={{ marginBottom: 18 }}>
              <label htmlFor="clave">Contraseña</label>
              <input
                id="clave"
                className="input"
                type="password"
                placeholder="••••••••"
                value={clave}
                onChange={e => setClave(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="field-error" style={{ margin: '0 0 12px' }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 16, fontSize: 14 }}>
              <Link to="/registro" className="link" style={{ fontSize: 14 }}>
                Registrarse
              </Link>
              <span style={{ color: 'var(--line)' }}>·</span>
              <Link to="/recuperar" className="link" style={{ fontSize: 14 }}>
                Recuperar
              </Link>
            </div>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <a
                href={URL_COMITE_UCH}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--slate-500)', textDecoration: 'none' }}
              >
                Acerca del Comité de Ética ↗
              </a>
            </div>
          </form>
        </div>
        <p style={{ textAlign: 'center', padding: '0 16px 20px', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.7)', margin: 0 }}>
          {APP_NOMBRE}
        </p>
      </div>

      <div className="d-auth-shell">
        <div className="d-auth-hero">
          {/* El patrón de rayas diagonales se quitó: el fondo ahora es la foto
              del campus (ver `.d-auth-hero` en global.css) y las rayas encima
              solo ensuciaban la imagen. */}
          <div style={{ position: 'relative' }}>
            <Logo size={54} />
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, margin: '22px 0 14px', maxWidth: 420 }}>
              {APP_NOMBRE}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.85, maxWidth: 380 }}>
              Gestiona la evaluación ética de tus proyectos de investigación de principio a fin: envío, subsanación y
              dictamen, todo en un solo lugar.
            </div>
            {MOSTRAR_LOGO && (
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, letterSpacing: 1.2, marginTop: 40 }}>
                UNIVERSIDAD DE CIENCIAS Y HUMANIDADES
              </div>
            )}
          </div>
        </div>
        <div className="d-auth-form-panel">
          <form onSubmit={onSubmit}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Iniciar sesión</div>
            <div style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 28 }}>Ingresa con tu correo institucional</div>

            <div className="d-field-label">Correo institucional</div>
            <input
              className="d-field"
              style={{ marginBottom: 16, height: 42 }}
              type="email"
              placeholder="usuario@uch.pe"
              value={correo}
              onChange={e => setCorreo(e.target.value)}
              autoComplete="email"
            />
            <div className="d-field-label">Contraseña</div>
            <input
              className="d-field"
              style={{ marginBottom: 22, height: 42 }}
              type="password"
              placeholder="••••••••"
              value={clave}
              onChange={e => setClave(e.target.value)}
              autoComplete="current-password"
            />

            {error && (
              <p className="field-error" style={{ margin: '0 0 16px' }}>
                {error}
              </p>
            )}

            <button type="submit" className="d-btn-primary" style={{ width: '100%', marginBottom: 16 }} disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600 }}>
              <Link to="/registro" className="link">
                Crear cuenta
              </Link>
              <Link to="/recuperar" className="link">
                Recuperar contraseña
              </Link>
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <a
                href={URL_COMITE_UCH}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--slate-500)', textDecoration: 'none' }}
              >
                Acerca del Comité de Ética ↗
              </a>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
