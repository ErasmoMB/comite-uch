import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import DesktopSidebar from '../components/DesktopSidebar'
import DesktopTopbar from '../components/DesktopTopbar'
import { ROL_LABEL, ROLES_SOLICITANTE } from '../data/types'
import { evaluacionService, expedientesService } from '../services'
import { useApp } from '../state/AppContext'

interface Stat {
  n: number
  label: string
  color: string
}

export default function Perfil() {
  const { usuario, logout } = useApp()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stat[]>([])
  const [totalRegistros, setTotalRegistros] = useState<number | null>(null)

  const esSolicitante = usuario ? ROLES_SOLICITANTE.includes(usuario.rol) : false

  useEffect(() => {
    if (!usuario) return
    const rol = usuario.rol
    let cancelado = false

    async function cargar() {
      try {
        if (esSolicitante) {
          const proyectos = await expedientesService.list()
          if (cancelado) return
          setTotalRegistros(proyectos.length)
          setStats([
            { n: proyectos.filter(p => p.estado === 'en_revision' || p.estado === 'enviado').length, label: 'En revisión', color: 'var(--primary)' },
            { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: 'var(--success)' },
            { n: proyectos.filter(p => p.estado === 'subsanacion').length, label: 'Subsanación', color: 'var(--warn)' },
          ])
        } else if (rol === 'evaluador') {
          const evaluaciones = await evaluacionService.misEvaluaciones()
          if (cancelado) return
          setTotalRegistros(evaluaciones.length)
          setStats([
            { n: evaluaciones.filter(e => !e.completa).length, label: 'Pendientes', color: 'var(--primary)' },
            { n: evaluaciones.filter(e => e.completa).length, label: 'Completadas', color: 'var(--success)' },
          ])
        } else {
          const proyectos = await expedientesService.list()
          if (cancelado) return
          setTotalRegistros(proyectos.length)
          setStats([
            { n: proyectos.filter(p => p.estado === 'enviado' || p.estado === 'en_revision').length, label: 'Enviados', color: 'var(--primary)' },
            { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: 'var(--success)' },
          ])
        }
      } catch {
        if (!cancelado) setStats([])
      }
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [usuario, esSolicitante])

  const filas = [
    { label: 'Correo institucional', valor: usuario?.correo ?? '—' },
    ...(usuario?.codigo ? [{ label: 'Código de estudiante', valor: usuario.codigo }] : []),
    ...(usuario?.laboratorio ? [{ label: 'Laboratorio', valor: usuario.laboratorio }] : []),
    ...(usuario?.especialidad ? [{ label: 'Especialidad', valor: usuario.especialidad }] : []),
    ...(totalRegistros !== null ? [{ label: esSolicitante ? 'Proyectos registrados' : 'Expedientes vinculados', valor: String(totalRegistros) }] : []),
  ]

  function cerrarSesion() {
    logout()
    navigate('/login')
  }

  return (
    <>
      <div className="mobile-only">
      <header className="topbar" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <h1>Mi perfil</h1>
      </header>

      <div className="screen-body" style={{ padding: '18px 16px 22px', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '6px 0 4px' }}>
          <Avatar size={72} style={{ background: 'var(--navy)', color: '#fff' }} />
          <strong style={{ fontSize: 17 }}>
            {usuario?.nombres} {usuario?.apellidos}
          </strong>
          <span className="badge badge-blue">{usuario ? ROL_LABEL[usuario.rol] : ''}</span>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {filas.map(f => (
            <div key={f.label} className="list-row">
              <span className="small" style={{ color: 'var(--slate-500)' }}>
                {f.label}
              </span>
              <strong style={{ fontSize: 13 }}>{f.valor}</strong>
            </div>
          ))}
        </div>

        <button className="btn btn-danger-outline" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>

      <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Mi perfil" />
          <div className="d-content" style={{ flexDirection: 'row' }}>
            <div className="card" style={{ width: 300, flex: 'none', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, height: 'fit-content' }}>
              <Avatar size={84} style={{ background: 'var(--navy)', color: '#fff' }} />
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {usuario?.nombres} {usuario?.apellidos}
              </div>
              <span className="badge badge-blue">{usuario ? ROL_LABEL[usuario.rol] : ''}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 14 }}>
                <button className="d-btn-danger" style={{ width: '100%' }} onClick={cerrarSesion}>
                  Cerrar sesión
                </button>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--line-soft)', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                  Información de la cuenta
                </div>
                {filas.map(f => (
                  <div key={f.label} className="list-row">
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate-500)' }}>{f.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{f.valor}</span>
                  </div>
                ))}
              </div>
              {stats.length > 0 && (
                <div style={{ display: 'flex', gap: 16 }}>
                  {stats.map(s => (
                    <div key={s.label} className="card" style={{ flex: 1, padding: '16px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.n}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--slate-500)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
