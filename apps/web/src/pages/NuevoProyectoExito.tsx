import { Link, useLocation, useNavigate } from 'react-router-dom'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'

export default function NuevoProyectoExito() {
  const { state } = useLocation() as { state?: { codigo?: string; id?: string } }
  const navigate = useNavigate()
  const codigo = state?.codigo ?? '—'
  const id = state?.id

  function Contenido({ desktop = false }: { desktop?: boolean }) {
    return (
      <>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            background: 'var(--blue-50)',
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
              background: 'var(--primary)',
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
        <h2 style={{ fontSize: 21, color: 'var(--navy)', margin: '0 0 10px' }}>¡Proyecto enviado!</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--slate-500)', margin: '0 0 20px' }}>
          Tu proyecto fue registrado y pasará a revisión administrativa. Recibirás notificaciones sobre su avance.
        </p>
        <div style={{ background: 'var(--navy)', borderRadius: 16, padding: '18px 28px', color: '#fff', marginBottom: 24 }}>
          <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>CÓDIGO ASIGNADO</div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>{codigo}</div>
        </div>
        <button
          className={desktop ? 'd-btn-primary' : 'btn btn-primary'}
          style={{ marginBottom: 10, width: desktop ? '100%' : undefined }}
          onClick={() => (id ? navigate(`/proyectos/${id}`) : navigate('/proyectos'))}
        >
          Ver detalle del proyecto
        </button>
        <Link to="/" className={desktop ? 'd-btn-ghost' : 'btn btn-outline'} style={{ width: desktop ? '100%' : undefined, textAlign: 'center' }}>
          Ir al inicio
        </Link>
      </>
    )
  }

  return (
    <>
      <div className="mobile-only">
        <div className="screen-body" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 26px' }}>
          <Contenido />
        </div>
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Nuevo proyecto" />
          <div className="d-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ maxWidth: 460, width: '100%', padding: '40px 36px', textAlign: 'center' }}>
              <Contenido desktop />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
