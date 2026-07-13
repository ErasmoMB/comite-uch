// app/(app)/proyectos/index.tsx
import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, ErrorText, Field, Input, Loading, Screen, StatusBadge } from '../../../src/components/ui'
import Avatar from '../../../src/components/Avatar'
import { colors } from '../../../src/lib/theme'
import type { Proyecto } from '../../../src/data/types'
import { ApiError } from '../../../src/lib/http'
import { fechaLocalISO, formatearFecha } from '../../../src/lib/dates'
import { toDomainProyecto } from '../../../src/lib/mappers'
import { expedientesService } from '../../../src/services'
import { useApp } from '../../../src/state/AppContext'
import { useConfirm } from '../../../src/state/ConfirmContext'

export default function Proyectos() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const confirmar = useConfirm()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const cargar = useCallback(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const dtos = await expedientesService.list()
        if (activo) setProyectos(dtos.map(dto => toDomainProyecto(dto)))
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus proyectos.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => {
      activo = false
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      const cancelar = cargar()
      return cancelar
    }, [cargar])
  )

  const filtrados = useMemo(() => {
    const lista = proyectos.filter(p => {
      const q = busqueda.trim().toLowerCase()
      const coincideTexto = !q || p.titulo.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q)
      const fechaProyecto = p.fechaCreacion ? fechaLocalISO(p.fechaCreacion) : null
      const coincideDesde = !fechaDesde || (fechaProyecto !== null && fechaProyecto >= fechaDesde)
      const coincideHasta = !fechaHasta || (fechaProyecto !== null && fechaProyecto <= fechaHasta)
      return coincideTexto && coincideDesde && coincideHasta
    })
    // Siempre el más reciente primero, sin control manual de orden.
    return [...lista].sort((a, b) => (a.fechaCreacion < b.fechaCreacion ? 1 : -1))
  }, [proyectos, busqueda, fechaDesde, fechaHasta])

  async function eliminar(p: Proyecto) {
    if (!(await confirmar(`¿Eliminar el borrador "${p.titulo}"?`, { titulo: 'Eliminar borrador', textoConfirmar: 'Eliminar', peligroso: true }))) return
    try {
      await expedientesService.remove(p.id)
      setProyectos(prev => prev.filter(x => x.id !== p.id))
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'No se pudo eliminar el proyecto.')
    }
  }

  function accion(p: Proyecto) {
    switch (p.estado) {
      case 'subsanacion':
        // No hay pantalla de subsanación en este alcance: se navega al detalle.
        return { texto: 'Ver detalle ›', onPress: () => router.push(`/(app)/proyectos/${p.id}`) }
      case 'borrador':
        return null
      default:
        return { texto: 'Ver detalle ›', onPress: () => router.push(`/(app)/proyectos/${p.id}`) }
    }
  }

  function limpiar() {
    setBusqueda('')
    setFechaDesde('')
    setFechaHasta('')
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <Text style={s.headerTitle}>Mis proyectos</Text>
        <Pressable onPress={() => router.push('/(app)/perfil')}>
          <Avatar nombres={usuario?.nombres} apellidos={usuario?.apellidos} />
        </Pressable>
      </View>

      <Screen>
        <Pressable onPress={() => router.push('/(app)/cambiar-titulo')}>
          <Text style={s.link}>Cambiar título de un proyecto aprobado ›</Text>
        </Pressable>

        <Input
          placeholder="Buscar por código o título…"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
        />

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Desde">
              <Input placeholder="AAAA-MM-DD" value={fechaDesde} onChangeText={setFechaDesde} autoCapitalize="none" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Hasta">
              <Input placeholder="AAAA-MM-DD" value={fechaHasta} onChangeText={setFechaHasta} autoCapitalize="none" />
            </Field>
          </View>
          <Pressable onPress={limpiar} style={s.clearBtn}>
            <Text style={s.clearBtnText}>Limpiar</Text>
          </Pressable>
        </View>

        {cargando && <Loading label="Cargando proyectos…" />}
        {!cargando && !!error && <ErrorText>{error}</ErrorText>}

        {!cargando && !error && (
          <>
            <Text style={s.contador}>
              Mostrando {filtrados.length} de {proyectos.length}
            </Text>

            <View style={{ gap: 10 }}>
              {filtrados.map(p => {
                const acc = accion(p)
                return (
                  <Card key={p.id} style={{ padding: 13 }}>
                    <View style={s.cardTop}>
                      <Text numberOfLines={1} style={s.cardTitulo}>{p.titulo}</Text>
                      <StatusBadge estado={p.estado} />
                    </View>
                    <View style={s.cardBottom}>
                      <Text style={s.cardMeta}>
                        {p.codigo ?? '—'} · {formatearFecha(p.fechaEnvio, 'sin enviar')}
                      </Text>
                      {acc ? (
                        <Pressable onPress={acc.onPress}>
                          <Text style={s.link}>{acc.texto}</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => eliminar(p)}>
                          <Text style={s.linkDanger}>Eliminar</Text>
                        </Pressable>
                      )}
                    </View>
                  </Card>
                )
              })}
              {filtrados.length === 0 && (
                <Text style={s.vacio}>No se encontraron proyectos con esos filtros.</Text>
              )}
            </View>
          </>
        )}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  linkDanger: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  clearBtn: { height: 44, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { color: colors.slate500, fontSize: 13, fontWeight: '600' },
  contador: { fontSize: 13, fontWeight: '500', color: colors.slate400 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 7 },
  cardTitulo: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { fontSize: 12.5, fontWeight: '500', color: colors.slate400 },
  vacio: { textAlign: 'center', fontSize: 13.5, color: colors.slate500, marginVertical: 24 },
})
