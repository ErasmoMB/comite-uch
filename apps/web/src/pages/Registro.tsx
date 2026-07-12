import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo, TopBar } from '../components/shared'
import { ROL_LABEL, ROLES_AUTO_REGISTRO, type Rol } from '../data/types'
import { ApiError } from '../lib/http'
import { useApp } from '../state/AppContext'

const OPCIONES_ROL = ROLES_AUTO_REGISTRO.map(rol => ({ value: rol, label: ROL_LABEL[rol] }))

export default function Registro() {
  const { registrar } = useApp()
  const navigate = useNavigate()
  const [f, setF] = useState({
    nombres: '',
    apellidos: '',
    correo: '',
    rol: OPCIONES_ROL[0].value as Rol,
    codigo: '',
    clave: '',
    confirmar: '',
  })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esEstudiante = f.rol === 'estudiante_pregrado' || f.rol === 'estudiante_postgrado'
  const esInvestigador = f.rol === 'investigador'
  const etiquetaCodigo = esInvestigador ? 'Laboratorio (opcional)' : 'Código de estudiante'

  function campo(k: keyof typeof f) {
    return {
      value: f[k],
      onChange: (e: { target: { value: string } }) => setF(prev => ({ ...prev, [k]: e.target.value })),
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f.nombres.trim() || !f.apellidos.trim() || !f.correo.trim() || !f.clave) {
      setError('Completa todos los campos obligatorios.')
      return
    }
    if (!/@uch\.(pe|edu\.pe)$/i.test(f.correo.trim())) {
      setError('Usa tu correo institucional (@uch.pe).')
      return
    }
    if (f.clave.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (f.clave !== f.confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError('')
    setEnviando(true)
    try {
      await registrar({
        nombre: f.nombres.trim(),
        apellido: f.apellidos.trim(),
        email: f.correo.trim(),
        password: f.clave,
        rol: f.rol,
        codigoEstudiante: esEstudiante ? f.codigo.trim() || undefined : undefined,
        laboratorio: f.rol === 'investigador' ? f.codigo.trim() || undefined : undefined,
      })
      navigate('/registro/exito', { state: { correo: f.correo.trim() } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="mobile-only">
      <TopBar titulo="Crear cuenta" />
      <form className="screen-body" style={{ padding: '16px 18px 24px', gap: 13 }} onSubmit={onSubmit}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Nombres</label>
            <input className="input" placeholder="María" {...campo('nombres')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Apellidos</label>
            <input className="input" placeholder="Fernández" {...campo('apellidos')} />
          </div>
        </div>

        <div className="field">
          <label>Correo institucional</label>
          <input className="input" type="email" placeholder="usuario@uch.pe" {...campo('correo')} />
        </div>

        <div className="field">
          <label>Rol</label>
          <div className="select-wrap">
            <select className="select" {...campo('rol')}>
              {OPCIONES_ROL.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {(esEstudiante || esInvestigador) && (
          <div
            style={{
              background: 'var(--blue-50)',
              border: '1px solid var(--blue-100)',
              borderRadius: 11,
              padding: '11px 12px',
            }}
          >
            <div className="field">
              <label style={{ color: 'var(--primary)' }}>{etiquetaCodigo}</label>
              <input className="input" placeholder={esInvestigador ? 'Lab. Central' : '2021xxxxx'} style={{ borderColor: 'var(--blue-100)' }} {...campo('codigo')} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Contraseña</label>
            <input className="input" type="password" placeholder="••••••" {...campo('clave')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Confirmar</label>
            <input className="input" type="password" placeholder="••••••" {...campo('confirmar')} />
          </div>
        </div>

        {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }} disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--slate-500)', margin: 0 }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="link" style={{ fontSize: 13.5 }}>
            Ingresar
          </Link>
        </p>
      </form>
      </div>

      <div className="d-auth-shell">
        <div style={{ width: 420, flex: 'none', background: 'linear-gradient(160deg, #08204A, #0b57b7)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 56, color: '#fff' }}>
          <Logo size={48} />
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3, margin: '20px 0 12px' }}>Crea tu cuenta de solicitante</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, opacity: 0.85 }}>
            Regístrate con tu correo institucional para enviar y hacer seguimiento a tus proyectos de investigación.
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 72px', overflowY: 'auto' }}>
          <form onSubmit={onSubmit} style={{ maxWidth: 560, width: '100%' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 22 }}>Crear cuenta</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div className="d-field-label">Nombres</div>
                <input className="d-field" placeholder="María" {...campo('nombres')} />
              </div>
              <div>
                <div className="d-field-label">Apellidos</div>
                <input className="d-field" placeholder="Fernández" {...campo('apellidos')} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div className="d-field-label">Correo institucional</div>
                <input className="d-field" type="email" placeholder="usuario@uch.pe" {...campo('correo')} />
              </div>
              <div>
                <div className="d-field-label">Rol</div>
                <select className="d-field" {...campo('rol')}>
                  {OPCIONES_ROL.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {(esEstudiante || esInvestigador) && (
              <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 9, padding: '12px 14px', marginBottom: 14 }}>
                <div className="d-field-label" style={{ color: 'var(--primary)' }}>
                  {etiquetaCodigo}
                </div>
                <input className="d-field" style={{ borderColor: 'var(--blue-100)' }} placeholder={esInvestigador ? 'Lab. Central' : '2021xxxxx'} {...campo('codigo')} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
              <div>
                <div className="d-field-label">Contraseña</div>
                <input className="d-field" type="password" placeholder="••••••••" {...campo('clave')} />
              </div>
              <div>
                <div className="d-field-label">Confirmar contraseña</div>
                <input className="d-field" type="password" placeholder="••••••••" {...campo('confirmar')} />
              </div>
            </div>

            {error && (
              <p className="field-error" style={{ margin: '0 0 14px' }}>
                {error}
              </p>
            )}

            <button type="submit" className="d-btn-primary" style={{ width: '100%', marginBottom: 14 }} disabled={enviando}>
              {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 500, color: 'var(--slate-500)', margin: 0 }}>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="link">
                Ingresar
              </Link>
            </p>
          </form>
        </div>
      </div>
    </>
  )
}
