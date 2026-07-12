import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/shared'
import { ApiError } from '../lib/http'
import { authService } from '../services'

function Progreso({ actual }: { actual: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
      {[1, 2, 3, 4].map(n => (
        <div key={n} style={{ display: 'contents' }}>
          {n > 1 && <div style={{ width: 28, height: 2, background: n <= actual ? 'var(--primary)' : 'var(--line)' }} />}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: n <= actual ? 'var(--primary)' : 'var(--blue-50)',
              color: n <= actual ? '#fff' : 'var(--slate-400)',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {n < actual ? '✓' : n}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Recuperar() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)
  const [correo, setCorreo] = useState('')
  const [codigo, setCodigo] = useState(['', '', '', '', '', ''])
  const [clave, setClave] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)
  const refs = useRef<Array<HTMLInputElement | null>>([])

  async function siguiente(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (paso === 1) {
      if (!correo.trim()) return setError('Ingresa tu correo institucional.')
      setEnviando(true)
      try {
        await authService.solicitarRecuperacion(correo.trim())
        setPaso(2)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo enviar el código. Intenta nuevamente.')
      } finally {
        setEnviando(false)
      }
    } else if (paso === 2) {
      if (codigo.some(d => d === '')) return setError('Completa los 6 dígitos del código.')
      setEnviando(true)
      try {
        await authService.verificarCodigoRecuperacion(correo.trim(), codigo.join(''))
        setPaso(3)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Código inválido o vencido.')
      } finally {
        setEnviando(false)
      }
    } else if (paso === 3) {
      if (clave.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
      if (clave !== confirmar) return setError('Las contraseñas no coinciden.')
      setEnviando(true)
      try {
        await authService.cambiarPasswordRecuperacion(correo.trim(), codigo.join(''), clave)
        setPaso(4)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la contraseña. Intenta nuevamente.')
      } finally {
        setEnviando(false)
      }
    }
  }

  async function reenviarCodigo() {
    setError('')
    setReenviado(false)
    setEnviando(true)
    try {
      await authService.solicitarRecuperacion(correo.trim())
      setReenviado(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reenviar el código.')
    } finally {
      setEnviando(false)
    }
  }

  function onDigito(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1)
    setCodigo(prev => prev.map((c, j) => (j === i ? d : c)))
    if (d && i < 5) refs.current[i + 1]?.focus()
  }

  function PasoContenido() {
    return (
      <>
        <Progreso actual={paso} />

        {paso === 1 && (
          <>
            <h2 style={{ fontSize: 18, color: 'var(--navy)', margin: '0 0 8px' }}>Ingresa tu correo</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--slate-500)', margin: '0 0 20px' }}>
              Te enviaremos un código de verificación a tu correo institucional.
            </p>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Correo institucional</label>
              <input
                className="input"
                type="email"
                placeholder="usuario@uch.pe"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
              />
            </div>
            {error && <p className="field-error" style={{ margin: '0 0 14px' }}>{error}</p>}
            <button className="btn btn-primary" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar código'}
            </button>
          </>
        )}

        {paso === 2 && (
          <>
            <h2 style={{ fontSize: 18, color: 'var(--navy)', margin: '0 0 8px' }}>Ingresa el código</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--slate-500)', margin: '0 0 22px' }}>
              Enviamos un código de 6 dígitos a tu correo institucional.
            </p>
            <div className="otp-row" style={{ marginBottom: 20 }}>
              {codigo.map((d, i) => (
                <input
                  key={i}
                  ref={el => {
                    refs.current[i] = el
                  }}
                  className={`otp-box ${d ? 'filled' : ''}`}
                  inputMode="numeric"
                  value={d}
                  onChange={e => onDigito(i, e.target.value)}
                  aria-label={`Dígito ${i + 1}`}
                />
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--slate-500)', margin: '0 0 22px' }}>
              ¿No llegó?{' '}
              <button type="button" className="link" style={{ fontSize: 13.5 }} disabled={enviando} onClick={reenviarCodigo}>
                Reenviar código
              </button>
            </p>
            {reenviado && !error && (
              <p className="small" style={{ textAlign: 'center', color: 'var(--success)', margin: '0 0 14px' }}>
                Código reenviado. Revisa tu correo.
              </p>
            )}
            {error && <p className="field-error" style={{ margin: '0 0 14px', textAlign: 'center' }}>{error}</p>}
            <button className="btn btn-primary" disabled={enviando}>
              {enviando ? 'Verificando…' : 'Verificar código'}
            </button>
          </>
        )}

        {paso === 3 && (
          <>
            <h2 style={{ fontSize: 18, color: 'var(--navy)', margin: '0 0 8px' }}>Nueva contraseña</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--slate-500)', margin: '0 0 20px' }}>
              Crea una nueva contraseña para tu cuenta.
            </p>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Nueva contraseña</label>
              <input className="input" type="password" placeholder="••••••" value={clave} onChange={e => setClave(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Confirmar contraseña</label>
              <input
                className="input"
                type="password"
                placeholder="••••••"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
              />
            </div>
            {error && <p className="field-error" style={{ margin: '0 0 14px' }}>{error}</p>}
            <button className="btn btn-primary" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </>
        )}

        {paso === 4 && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: 'var(--success-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 22px',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
            </div>
            <h2 style={{ fontSize: 20, color: 'var(--navy)', margin: '0 0 10px' }}>¡Contraseña actualizada!</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--slate-500)', margin: '0 0 26px' }}>
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
              Ir al inicio de sesión
            </button>
          </div>
        )}

        {paso < 4 && (
          <p style={{ textAlign: 'center', marginTop: 18 }}>
            <Link to="/login" className="link">
              Volver al inicio de sesión
            </Link>
          </p>
        )}
      </>
    )
  }

  return (
    <>
      <div className="mobile-only">
        <TopBar titulo="Recuperar contraseña" />
        <form className="screen-body" style={{ padding: '22px 20px' }} onSubmit={siguiente}>
          <PasoContenido />
        </form>
      </div>

      <div className="d-centered-shell">
        <form className="card" style={{ maxWidth: 440, width: '100%', padding: '36px 40px' }} onSubmit={siguiente}>
          <PasoContenido />
        </form>
      </div>
    </>
  )
}
