import { Link, useLocation } from 'react-router-dom'

export default function RegistroExito() {
  const { state } = useLocation() as { state?: { correo?: string } }
  const correo = state?.correo ?? 'usuario@uch.pe'

  function Contenido() {
    return (
      <>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            background: 'var(--success-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
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
        <h2 style={{ fontSize: 21, color: 'var(--navy)', margin: '0 0 10px' }}>¡Cuenta creada!</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--slate-500)', margin: '0 0 28px' }}>
          Tu cuenta fue registrada con el correo <b style={{ color: 'var(--ink)' }}>{correo}</b>. Ya puedes iniciar
          sesión y enviar tu primer proyecto.
        </p>
        <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
          Ir al inicio de sesión
        </Link>
      </>
    )
  }

  return (
    <>
      <div className="mobile-only">
        <div className="screen-body" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 32px' }}>
          <Contenido />
        </div>
      </div>

      <div className="d-centered-shell">
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: '40px 36px', textAlign: 'center' }}>
          <Contenido />
        </div>
      </div>
    </>
  )
}
