import { useEffect, useMemo, useState, type FormEvent } from 'react'
import BottomNav from '../../components/BottomNav'
import DesktopSidebar from '../../components/DesktopSidebar'
import DesktopTopbar from '../../components/DesktopTopbar'
import { ROL_LABEL } from '../../data/types'
import { ApiError } from '../../lib/http'
import { usersService } from '../../services'
import { useApp } from '../../state/AppContext'
import { useConfirm } from '../../state/ConfirmContext'
import type { RolBackend, UserDto } from '../../types/api'

const ROLES_INTERNOS: RolBackend[] = ['administrador', 'coordinador', 'secretaria', 'evaluador']
const FILTROS_ESTADO = ['todos', 'activos', 'inactivos'] as const
type FiltroEstado = (typeof FILTROS_ESTADO)[number]
const FILTRO_ESTADO_LABEL: Record<FiltroEstado, string> = { todos: 'Todos', activos: 'Activos', inactivos: 'Inactivos' }

const FORM_INICIAL = {
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  rol: 'coordinador' as RolBackend,
  especialidad: '',
  cargaTrabajo: '',
}

export default function Usuarios() {
  const { usuario } = useApp()
  const confirmar = useConfirm()
  const [usuarios, setUsuarios] = useState<UserDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<RolBackend | 'todos'>('todos')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')

  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [formError, setFormError] = useState('')
  const [creando, setCreando] = useState(false)

  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editRol, setEditRol] = useState<RolBackend>('coordinador')
  const [editActivo, setEditActivo] = useState(true)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [accionError, setAccionError] = useState('')

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const lista = await usersService.list(0, 200)
      setUsuarios(lista)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de usuarios.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function campo(k: keyof typeof form) {
    return {
      value: form[k],
      onChange: (e: { target: { value: string } }) => setForm(prev => ({ ...prev, [k]: e.target.value })),
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim() || !form.password) {
      setFormError('Completa todos los campos obligatorios.')
      return
    }
    if (form.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (form.rol === 'evaluador' && !form.especialidad.trim()) {
      setFormError('Indica la especialidad del evaluador.')
      return
    }
    setFormError('')
    setCreando(true)
    try {
      await usersService.create({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        password: form.password,
        rol: form.rol,
        especialidad: form.rol === 'evaluador' ? form.especialidad.trim() : undefined,
        cargaTrabajo: form.rol === 'evaluador' && form.cargaTrabajo ? Number(form.cargaTrabajo) : undefined,
      })
      setForm(FORM_INICIAL)
      setMostrarForm(false)
      await cargar()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.')
    } finally {
      setCreando(false)
    }
  }

  function iniciarEdicion(u: UserDto) {
    setAccionError('')
    setEditandoId(u.id)
    setEditRol(u.rol)
    setEditActivo(u.activo !== false)
  }

  async function guardarEdicion(id: number) {
    setGuardandoEdicion(true)
    setAccionError('')
    try {
      await usersService.update(id, { rol: editRol, activo: editActivo })
      setEditandoId(null)
      await cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo actualizar el usuario.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  async function desactivar(u: UserDto) {
    if (u.id === usuario?.id) {
      window.alert('No puedes desactivar tu propia cuenta.')
      return
    }
    if (!(await confirmar(`¿Desactivar a ${u.nombre} ${u.apellido}?`, { titulo: 'Desactivar usuario', textoConfirmar: 'Desactivar', peligroso: true }))) return
    setAccionError('')
    try {
      await usersService.deactivate(u.id)
      await cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo desactivar al usuario.')
    }
  }

  async function eliminarPermanente(u: UserDto) {
    if (u.id === usuario?.id) {
      window.alert('No puedes eliminar tu propia cuenta.')
      return
    }
    if (
      !(await confirmar(
        `Esto borra la cuenta de ${u.nombre} ${u.apellido} de forma permanente (no se puede deshacer). Solo funciona si no tiene evaluaciones ni mensajes de chat registrados -- si los tiene, usa "Desactivar" en su lugar.`,
        { titulo: 'Eliminar usuario permanentemente', textoConfirmar: 'Eliminar', peligroso: true },
      ))
    )
      return
    setAccionError('')
    try {
      await usersService.eliminarPermanente(u.id)
      await cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo eliminar al usuario.')
    }
  }

  // La lista real trae cualquier rol (no solo internos: el filtro debe
  // ofrecer los que de verdad aparecen, calculados sobre los datos en vez de
  // codificar a mano una lista que podría quedar corta).
  const rolesPresentes = useMemo(
    () => Array.from(new Set(usuarios.map(u => u.rol))).sort((a, b) => ROL_LABEL[a].localeCompare(ROL_LABEL[b])),
    [usuarios],
  )

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter(u => {
      const coincideTexto = !q || `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      const coincideRol = filtroRol === 'todos' || u.rol === filtroRol
      const coincideEstado =
        filtroEstado === 'todos' || (filtroEstado === 'activos' ? u.activo !== false : u.activo === false)
      return coincideTexto && coincideRol && coincideEstado
    })
  }, [usuarios, busqueda, filtroRol, filtroEstado])

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroRol('todos')
    setFiltroEstado('todos')
  }

  const formulario = (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <strong style={{ fontSize: 14 }}>Nuevo usuario interno</strong>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Nombres</label>
            <input className="input" placeholder="María" {...campo('nombre')} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Apellidos</label>
            <input className="input" placeholder="Fernández" {...campo('apellido')} />
          </div>
        </div>

        <div className="field">
          <label>Correo institucional</label>
          <input className="input" type="email" placeholder="usuario@uch.pe" {...campo('email')} />
        </div>

        <div className="field">
          <label>Contraseña</label>
          <input className="input" type="password" placeholder="Mínimo 8 caracteres" {...campo('password')} />
        </div>

        <div className="field">
          <label>Rol</label>
          <div className="select-wrap">
            <select className="select" {...campo('rol')}>
              {ROLES_INTERNOS.map(r => (
                <option key={r} value={r}>{ROL_LABEL[r]}</option>
              ))}
            </select>
          </div>
        </div>

        {form.rol === 'evaluador' && (
          <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 11, padding: '11px 12px', display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label style={{ color: 'var(--primary)' }}>Especialidad</label>
              <input className="input" style={{ borderColor: 'var(--blue-100)' }} placeholder="Bioética" {...campo('especialidad')} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label style={{ color: 'var(--primary)' }}>Carga de trabajo</label>
              <input className="input" type="number" min={0} style={{ borderColor: 'var(--blue-100)' }} placeholder="0" {...campo('cargaTrabajo')} />
            </div>
          </div>
        )}

        {formError && <p className="field-error" style={{ margin: 0 }}>{formError}</p>}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setMostrarForm(false)
              setForm(FORM_INICIAL)
              setFormError('')
            }}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={creando}>
            {creando ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  )

  const filtros = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: '1 1 220px' }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--slate-400)"
          strokeWidth="2.2"
          strokeLinecap="round"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="input"
          style={{ paddingLeft: 34, height: 38 }}
          placeholder="Buscar por nombre o correo…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>
      <div className="select-wrap" style={{ flex: 'none' }}>
        <select className="select" style={{ height: 38, minWidth: 160 }} value={filtroRol} onChange={e => setFiltroRol(e.target.value as RolBackend | 'todos')}>
          <option value="todos">Todos los roles</option>
          {rolesPresentes.map(r => (
            <option key={r} value={r}>{ROL_LABEL[r]}</option>
          ))}
        </select>
      </div>
      <div className="select-wrap" style={{ flex: 'none' }}>
        <select className="select" style={{ height: 38, minWidth: 130 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}>
          {FILTROS_ESTADO.map(f => (
            <option key={f} value={f}>{FILTRO_ESTADO_LABEL[f]}</option>
          ))}
        </select>
      </div>
      <button
        className="link"
        style={{
          height: 38,
          padding: '0 14px',
          borderRadius: 10,
          background: 'var(--bg)',
          border: '1px solid var(--line-soft)',
          color: 'var(--slate-500)',
          fontSize: 13,
          flex: 'none',
        }}
        onClick={limpiarFiltros}
      >
        Limpiar
      </button>
    </div>
  )

  const tabla = (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)', fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Usuarios internos</span>
        <span style={{ fontWeight: 500, color: 'var(--slate-400)' }}>{usuariosFiltrados.length} de {usuarios.length}</span>
      </div>
      {cargando && <p className="muted small" style={{ padding: '14px 18px' }}>Cargando usuarios…</p>}
      {!cargando && usuariosFiltrados.length === 0 && (
        <p className="muted small" style={{ padding: '14px 18px' }}>
          {usuarios.length === 0 ? 'No hay usuarios registrados.' : 'Ningún usuario coincide con esos filtros.'}
        </p>
      )}
      {usuariosFiltrados.map(u => (
        <div key={u.id} className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ minWidth: 0, flex: '1 1 180px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.nombre} {u.apellido}
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>{u.email}</div>
          </div>

          {editandoId === u.id ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="select-wrap">
                <select className="select" style={{ minWidth: 150 }} value={editRol} onChange={e => setEditRol(e.target.value as RolBackend)}>
                  {ROLES_INTERNOS.map(r => (
                    <option key={r} value={r}>{ROL_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--slate-700)' }}>
                <input type="checkbox" checked={editActivo} onChange={e => setEditActivo(e.target.checked)} />
                Activo
              </label>
              <button className="link" disabled={guardandoEdicion} onClick={() => guardarEdicion(u.id)}>
                {guardandoEdicion ? 'Guardando…' : 'Guardar'}
              </button>
              <button className="link" style={{ color: 'var(--slate-500)' }} onClick={() => setEditandoId(null)}>
                Cancelar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge badge-blue">{ROL_LABEL[u.rol]}</span>
              <span className={`badge ${u.activo === false ? 'badge-archivado' : 'badge-aprobado'}`}>
                {u.activo === false ? 'Inactivo' : 'Activo'}
              </span>
              <button className="link" onClick={() => iniciarEdicion(u)}>
                Editar
              </button>
              <button
                className="link"
                style={{ color: u.id === usuario?.id ? 'var(--slate-400)' : 'var(--danger)' }}
                disabled={u.id === usuario?.id}
                onClick={() => desactivar(u)}
              >
                Desactivar
              </button>
              {ROLES_INTERNOS.includes(u.rol) && (
                <button
                  className="link"
                  style={{ color: u.id === usuario?.id ? 'var(--slate-400)' : 'var(--danger)', fontWeight: 700 }}
                  disabled={u.id === usuario?.id}
                  onClick={() => eliminarPermanente(u)}
                  title="Borra la cuenta de forma permanente (solo si no tiene evaluaciones ni mensajes registrados)"
                >
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const contenido = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <strong style={{ fontSize: 15 }}>Usuarios internos</strong>
        {!mostrarForm && (
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setMostrarForm(true)}>
            + Crear usuario
          </button>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
      {accionError && <p className="field-error">{accionError}</p>}
      {mostrarForm && formulario}
      {filtros}
      {tabla}
    </div>
  )

  return (
    <>
      <div className="mobile-only">
        <header className="topbar" style={{ borderBottom: '1px solid var(--line-soft)' }}>
          <h1>Usuarios</h1>
        </header>
        <div className="screen-body" style={{ padding: '16px', gap: 14 }}>
          {contenido}
        </div>
        <BottomNav />
      </div>

      <div className="desktop-shell">
        <DesktopSidebar />
        <div className="d-main">
          <DesktopTopbar titulo="Usuarios internos" />
          <div className="d-content">{contenido}</div>
        </div>
      </div>
    </>
  )
}
