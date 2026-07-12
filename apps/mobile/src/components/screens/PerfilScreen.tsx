// src/components/screens/PerfilScreen.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Screen } from '../ui'
import Avatar from '../Avatar'
import { colors } from '../../lib/theme'
import { ROL_LABEL, ROLES_SOLICITANTE } from '../../data/types'
import { expedientesService } from '../../services'
import { useApp } from '../../state/AppContext'

interface Stat {
  n: number
  label: string
  color: string
}

export default function PerfilScreen() {
  const { usuario, logout } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [stats, setStats] = useState<Stat[]>([])
  const [totalRegistros, setTotalRegistros] = useState<number | null>(null)

  const esSolicitante = usuario ? ROLES_SOLICITANTE.includes(usuario.rol) : false

  useEffect(() => {
    if (!usuario) return
    let cancelado = false
    async function cargar() {
      try {
        const proyectos = await expedientesService.list()
        if (cancelado) return
        setTotalRegistros(proyectos.length)
        if (esSolicitante) {
          setStats([
            { n: proyectos.filter(p => p.estado === 'en_revision' || p.estado === 'enviado').length, label: 'En revisión', color: colors.primary },
            { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: colors.success },
            { n: proyectos.filter(p => p.estado === 'subsanacion').length, label: 'Subsanación', color: colors.warn },
          ])
        } else {
          // Rama de rol interno (secretaría), calcada de la rama else de la web.
          setStats([
            { n: proyectos.filter(p => p.estado === 'enviado' || p.estado === 'en_revision').length, label: 'Enviados', color: colors.primary },
            { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobados', color: colors.success },
          ])
        }
      } catch {
        if (!cancelado) setStats([])
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [usuario, esSolicitante])

  const filas = [
    { label: 'Correo institucional', valor: usuario?.correo ?? '—' },
    ...(usuario?.codigo ? [{ label: 'Código de estudiante', valor: usuario.codigo }] : []),
    ...(usuario?.laboratorio ? [{ label: 'Laboratorio', valor: usuario.laboratorio }] : []),
    ...(usuario?.especialidad ? [{ label: 'Especialidad', valor: usuario.especialidad }] : []),
    ...(totalRegistros !== null ? [{ label: esSolicitante ? 'Proyectos registrados' : 'Expedientes vinculados', valor: String(totalRegistros) }] : []),
  ]

  async function cerrarSesion() {
    await logout()
    router.replace('/login')
  }

  return (
    <Screen>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} size={72} />
        <Text style={s.nombre}>{usuario?.nombres} {usuario?.apellidos}</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>{usuario ? ROL_LABEL[usuario.rol] : ''}</Text>
        </View>
      </View>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filas.map(f => (
          <View key={f.label} style={s.row}>
            <Text style={s.rowLabel}>{f.label}</Text>
            <Text style={s.rowValor}>{f.valor}</Text>
          </View>
        ))}
      </Card>

      {stats.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 9 }}>
          {stats.map(st => (
            <Card key={st.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: st.color }}>{st.n}</Text>
              <Text style={{ fontSize: 11, color: colors.slate500 }}>{st.label}</Text>
            </Card>
          ))}
        </View>
      )}

      <Button title="Cerrar sesión" variant="danger" onPress={cerrarSesion} />
    </Screen>
  )
}

const s = StyleSheet.create({
  header: { alignItems: 'center', gap: 9, paddingBottom: 6 },
  nombre: { fontSize: 17, fontWeight: '700', color: colors.ink },
  badge: { backgroundColor: colors.blue50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  rowLabel: { fontSize: 12.5, color: colors.slate500 },
  rowValor: { fontSize: 13, fontWeight: '700', color: colors.ink },
})
