// app/(app)/index.tsx
import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, Loading, ErrorText, StatusBadge, Screen } from '../../src/components/ui'
import Avatar from '../../src/components/Avatar'
import { colors } from '../../src/lib/theme'
import type { Proyecto } from '../../src/data/types'
import { ApiError } from '../../src/lib/http'
import { toDomainProyecto } from '../../src/lib/mappers'
import { expedientesService } from '../../src/services'
import { useApp } from '../../src/state/AppContext'

const CIERRE = new Date('2026-07-08T23:59:59')
function useCuentaRegresiva() {
  const [restante, setRestante] = useState(CIERRE.getTime() - Date.now())
  useEffect(() => {
    const t = setInterval(() => setRestante(CIERRE.getTime() - Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor(restante / 1000))
  return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), seg: s % 60 }
}

export default function Dashboard() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const cr = useCuentaRegresiva()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    let activo = true
    ;(async () => {
      setCargando(true); setError('')
      try {
        const dtos = await expedientesService.list()
        const ordenados = [...dtos].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        if (activo) setProyectos(ordenados.map(d => toDomainProyecto(d)))
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus proyectos.')
      } finally { if (activo) setCargando(false) }
    })()
    return () => { activo = false }
  }, [])

  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar])
  )

  const stats = [
    { n: proyectos.filter(p => p.estado === 'enviado' || p.estado === 'en_revision').length, label: 'Revisión', color: colors.primary },
    { n: proyectos.filter(p => p.estado === 'aprobado' || p.estado === 'aprobado_observaciones').length, label: 'Aprobado', color: colors.success },
    { n: proyectos.filter(p => p.estado === 'subsanacion').length, label: 'Subsanación', color: colors.warn },
    { n: proyectos.filter(p => p.estado === 'borrador').length, label: 'Borrador', color: colors.slate500 },
  ]
  const recientes = proyectos.slice(0, 3)

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={{ fontSize: 13, color: colors.slate500 }}>Buen día,</Text>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{usuario?.nombres} {usuario?.apellidos}</Text>
        </View>
        <Pressable onPress={() => router.push('/(app)/perfil')}><Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} /></Pressable>
      </View>
      <Screen>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Cierre de envíos de proyectos</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[cr.dias,'DÍAS'],[cr.horas,'HRS'],[cr.min,'MIN'],[cr.seg,'SEG']].map(([n,l]) => (
              <View key={l as string} style={s.bannerBox}>
                <Text style={s.bannerNum}>{String(n).padStart(2,'0')}</Text>
                <Text style={s.bannerLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          {stats.map(st => (
            <Card key={st.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 11 }}>
              <Text style={{ fontSize: 21, fontWeight: '700', color: st.color }}>{st.n}</Text>
              <Text style={{ fontSize: 11, color: colors.slate500 }}>{st.label}</Text>
            </Card>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700' }}>Mis proyectos recientes</Text>
          <Pressable onPress={() => router.push('/(app)/proyectos')}><Text style={{ color: colors.primary }}>Ver todos</Text></Pressable>
        </View>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {cargando && <Loading label="Cargando proyectos…" />}
          {!cargando && !!error && <View style={{ padding: 14 }}><ErrorText>{error}</ErrorText></View>}
          {!cargando && !error && recientes.map(p => (
            <Pressable key={p.id} style={s.row} onPress={() => router.push(`/(app)/proyectos/${p.id}`)}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600' }}>{p.titulo}</Text>
                <Text style={{ fontSize: 12, color: colors.slate400 }}>{p.codigo ?? 'Sin enviar'}</Text>
              </View>
              <StatusBadge estado={p.estado} />
            </Pressable>
          ))}
          {!cargando && !error && recientes.length === 0 && <Text style={{ padding: 14, color: colors.slate500 }}>Aún no tienes proyectos.</Text>}
        </Card>
      </Screen>
    </View>
  )
}
const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  banner: { backgroundColor: colors.navy, borderRadius: 18, padding: 16 },
  bannerTitle: { color: '#fff', opacity: 0.85, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  bannerBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  bannerNum: { color: '#fff', fontSize: 22, fontWeight: '700' },
  bannerLabel: { color: '#fff', opacity: 0.8, fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
})
