// app/(administrador)/index.tsx
import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Badge, Button, Card, ErrorText, Field, Input, Loading, Screen } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import { colors } from '../../src/lib/theme'
import { ApiError } from '../../src/lib/http'
import { filtrarUsuarios, type FiltroEstadoUsuario } from '../../src/lib/usuariosFilter'
import { usersService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'
import { useConfirm } from '../../src/state/ConfirmContext'
import { ROL_LABEL } from '../../src/data/types'
import type { RolBackend, UserDto } from '../../src/types/api'

const ROLES_INTERNOS: RolBackend[] = ['administrador', 'coordinador', 'secretaria', 'evaluador']
const ESTADOS: { key: FiltroEstadoUsuario; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'activos', label: 'Activos' },
  { key: 'inactivos', label: 'Inactivos' },
]

interface FormState {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: RolBackend
  especialidad: string
  cargaTrabajo: string
}
const FORM_INICIAL: FormState = {
  nombre: '', apellido: '', email: '', password: '',
  rol: 'coordinador', especialidad: '', cargaTrabajo: '',
}

export default function UsuariosAdmin() {
  const { usuario } = useApp()
  const confirmar = useConfirm()
  const insets = useSafeAreaInsets()

  const [usuarios, setUsuarios] = useState<UserDto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionError, setAccionError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<RolBackend | 'todos'>('todos')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoUsuario>('todos')

  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [formError, setFormError] = useState('')
  const [creando, setCreando] = useState(false)

  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editRol, setEditRol] = useState<RolBackend>('coordinador')
  const [editActivo, setEditActivo] = useState(true)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const cargar = useCallback(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const lista = await usersService.list(0, 200)
        if (activo) setUsuarios(lista)
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de usuarios.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  // useFocusEffect (NO useEffect mount-only): la lista debe refrescarse tras
  // crear/editar/desactivar/eliminar; Tabs mantiene la pantalla montada, así que
  // se recarga en cada focus (lección de Fases 4/5).
  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar]),
  )

  // Roles realmente presentes en los datos (no una lista fija que podría quedar
  // corta), ordenados por su etiqueta -- calcado de la web.
  const rolesPresentes = useMemo(
    () => Array.from(new Set(usuarios.map(u => u.rol))).sort((a, b) => ROL_LABEL[a].localeCompare(ROL_LABEL[b])),
    [usuarios],
  )

  const usuariosFiltrados = useMemo(
    () => filtrarUsuarios(usuarios, { busqueda, rol: filtroRol, estado: filtroEstado }),
    [usuarios, busqueda, filtroRol, filtroEstado],
  )

  function actualizarForm<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroRol('todos')
    setFiltroEstado('todos')
  }

  async function crearUsuario() {
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
      // Solo se envían especialidad/cargaTrabajo cuando el rol es evaluador
      // (NO se setea laboratorio ni codigoEstudiante), calcado de la web.
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
      cargar()
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
    if (id === usuario?.id) {
      setAccionError('No puedes cambiar el rol o el estado de tu propia cuenta.')
      return
    }
    setGuardandoEdicion(true)
    setAccionError('')
    try {
      await usersService.update(id, { rol: editRol, activo: editActivo })
      setEditandoId(null)
      cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo actualizar el usuario.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  async function desactivar(u: UserDto) {
    if (u.id === usuario?.id) {
      setAccionError('No puedes desactivar tu propia cuenta.')
      return
    }
    if (!(await confirmar(`¿Desactivar a ${u.nombre} ${u.apellido}?`, { titulo: 'Desactivar usuario', textoConfirmar: 'Desactivar', peligroso: true }))) return
    setAccionError('')
    try {
      await usersService.deactivate(u.id)
      cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo desactivar al usuario.')
    }
  }

  async function eliminarPermanente(u: UserDto) {
    if (u.id === usuario?.id) {
      setAccionError('No puedes eliminar tu propia cuenta.')
      return
    }
    if (!(await confirmar(
      `Esto borra la cuenta de ${u.nombre} ${u.apellido} de forma permanente (no se puede deshacer). Solo funciona si no tiene evaluaciones ni mensajes de chat registrados; si los tiene, usa "Desactivar" en su lugar.`,
      { titulo: 'Eliminar permanentemente', textoConfirmar: 'Eliminar', peligroso: true },
    ))) return
    setAccionError('')
    try {
      await usersService.eliminarPermanente(u.id)
      cargar()
    } catch (err) {
      setAccionError(err instanceof ApiError ? err.message : 'No se pudo eliminar al usuario.')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={s.headerKicker}>Administración</Text>
          <Text style={s.headerTitle}>Usuarios internos</Text>
        </View>
        {!mostrarForm && (
          <Pressable onPress={() => { setMostrarForm(true); setFormError('') }} style={s.nuevoBtn}>
            <Text style={s.nuevoBtnText}>+ Crear</Text>
          </Pressable>
        )}
      </View>

      <Screen>
        {!!error && <ErrorText>{error}</ErrorText>}
        {!!accionError && <ErrorText>{accionError}</ErrorText>}

        {mostrarForm && (
          <Card style={{ gap: 12 }}>
            <Text style={s.formTitulo}>Nuevo usuario interno</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Nombres"><Input placeholder="María" value={form.nombre} onChangeText={v => actualizarForm('nombre', v)} /></Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Apellidos"><Input placeholder="Fernández" value={form.apellido} onChangeText={v => actualizarForm('apellido', v)} /></Field>
              </View>
            </View>
            <Field label="Correo institucional">
              <Input placeholder="usuario@uch.pe" value={form.email} onChangeText={v => actualizarForm('email', v)} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
            </Field>
            <Field label="Contraseña">
              <Input placeholder="Mínimo 8 caracteres" value={form.password} onChangeText={v => actualizarForm('password', v)} secureTextEntry autoCapitalize="none" />
            </Field>
            <Field label="Rol">
              <View style={s.segment}>
                {ROLES_INTERNOS.map(r => (
                  <Pressable key={r} onPress={() => actualizarForm('rol', r)} style={[s.segItem, form.rol === r && s.segItemActive]}>
                    <Text style={[s.segText, form.rol === r && s.segTextActive]}>{ROL_LABEL[r]}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            {form.rol === 'evaluador' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Especialidad"><Input placeholder="Bioética" value={form.especialidad} onChangeText={v => actualizarForm('especialidad', v)} /></Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Carga de trabajo"><Input placeholder="0" value={form.cargaTrabajo} onChangeText={v => actualizarForm('cargaTrabajo', v)} keyboardType="number-pad" /></Field>
                </View>
              </View>
            )}
            {!!formError && <ErrorText>{formError}</ErrorText>}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancelar" variant="outline" onPress={() => { setMostrarForm(false); setForm(FORM_INICIAL); setFormError('') }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={creando ? 'Creando…' : 'Crear usuario'} loading={creando} onPress={crearUsuario} />
              </View>
            </View>
          </Card>
        )}

        <Input placeholder="Buscar por nombre o correo…" value={busqueda} onChangeText={setBusqueda} autoCapitalize="none" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.segmentScroll}>
          <Pressable onPress={() => setFiltroRol('todos')} style={[s.segItem, filtroRol === 'todos' && s.segItemActive]}>
            <Text style={[s.segText, filtroRol === 'todos' && s.segTextActive]}>Todos</Text>
          </Pressable>
          {rolesPresentes.map(r => (
            <Pressable key={r} onPress={() => setFiltroRol(r)} style={[s.segItem, filtroRol === r && s.segItemActive]}>
              <Text style={[s.segText, filtroRol === r && s.segTextActive]}>{ROL_LABEL[r]}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={s.segment}>
          {ESTADOS.map(e => (
            <Pressable key={e.key} onPress={() => setFiltroEstado(e.key)} style={[s.segItem, filtroEstado === e.key && s.segItemActive]}>
              <Text style={[s.segText, filtroEstado === e.key && s.segTextActive]}>{e.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.contador}>
            {cargando ? 'Cargando…' : `${usuariosFiltrados.length} de ${usuarios.length}`}
          </Text>
          <Pressable onPress={limpiarFiltros}><Text style={s.limpiar}>Limpiar</Text></Pressable>
        </View>

        <View style={{ gap: 10 }}>
          {cargando && <Loading label="Cargando usuarios…" />}
          {!cargando && usuariosFiltrados.map(u => {
            const esYo = u.id === usuario?.id
            const inactivo = u.activo === false
            const editando = editandoId === u.id
            return (
              <Card key={u.id} style={s.cardUsuario}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar nombres={u.nombre} apellidos={u.apellido} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={s.nombre}>{u.nombre} {u.apellido}</Text>
                    <Text numberOfLines={1} style={s.email}>{u.email}</Text>
                  </View>
                </View>

                {editando ? (
                  <View style={{ gap: 10 }}>
                    <View style={s.segment}>
                      {ROLES_INTERNOS.map(r => (
                        <Pressable key={r} onPress={() => setEditRol(r)} style={[s.segItem, editRol === r && s.segItemActive]}>
                          <Text style={[s.segText, editRol === r && s.segTextActive]}>{ROL_LABEL[r]}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable onPress={() => setEditActivo(v => !v)} style={s.check}>
                      <View style={[s.checkBox, editActivo && s.checkBoxOn]}>{editActivo && <Text style={s.checkMark}>✓</Text>}</View>
                      <Text style={s.checkLabel}>Cuenta activa</Text>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}><Button title="Cancelar" variant="outline" onPress={() => setEditandoId(null)} /></View>
                      <View style={{ flex: 1 }}><Button title={guardandoEdicion ? 'Guardando…' : 'Guardar'} loading={guardandoEdicion} onPress={() => guardarEdicion(u.id)} /></View>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Badge label={ROL_LABEL[u.rol]} bg={colors.blue50} fg={colors.primary} />
                      <Badge label={inactivo ? 'Inactivo' : 'Activo'} bg={inactivo ? colors.chipBg : colors.successBg} fg={inactivo ? colors.slate500 : colors.success} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      <Pressable disabled={esYo} onPress={() => iniciarEdicion(u)} style={[s.accionBtn, esYo && s.accionBtnOff]}>
                        <Text style={s.accionBtnText}>Editar</Text>
                      </Pressable>
                      <Pressable disabled={esYo} onPress={() => desactivar(u)} style={[s.accionBtn, s.accionBtnDanger, esYo && s.accionBtnOff]}>
                        <Text style={s.accionBtnDangerText}>Desactivar</Text>
                      </Pressable>
                      {ROLES_INTERNOS.includes(u.rol) && (
                        <Pressable disabled={esYo} onPress={() => eliminarPermanente(u)} style={[s.accionBtn, s.accionBtnDanger, esYo && s.accionBtnOff]}>
                          <Text style={s.accionBtnDangerText}>Eliminar</Text>
                        </Pressable>
                      )}
                    </View>
                  </>
                )}
              </Card>
            )
          })}
          {!cargando && !error && usuariosFiltrados.length === 0 && (
            <Text style={s.vacio}>{usuarios.length === 0 ? 'No hay usuarios registrados.' : 'Ningún usuario coincide con esos filtros.'}</Text>
          )}
        </View>
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerKicker: { fontSize: 12.5, color: colors.slate500 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  nuevoBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  nuevoBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  formTitulo: { fontSize: 14, fontWeight: '700', color: colors.navy },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentScroll: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  segItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 12.5, color: colors.slate500, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  contador: { fontSize: 13, fontWeight: '700', color: colors.navy },
  limpiar: { fontSize: 13, fontWeight: '600', color: colors.primary },
  cardUsuario: {
    gap: 10,
    shadowColor: colors.navy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  nombre: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  email: { fontSize: 12, color: colors.slate400, marginTop: 1 },
  accionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  accionBtnText: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  accionBtnDanger: { borderColor: colors.dangerBg, backgroundColor: colors.dangerBg },
  accionBtnDangerText: { fontSize: 12.5, fontWeight: '600', color: colors.danger },
  accionBtnOff: { opacity: 0.4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkLabel: { fontSize: 13, color: colors.slate700 },
  vacio: { textAlign: 'center', fontSize: 13.5, color: colors.slate500, marginTop: 24 },
})
