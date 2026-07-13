// app/(administrador)/configuracion.tsx
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, ErrorText, Field, Loading, Screen } from '../../src/components/ui'
import DateField from '../../src/components/DateField'
import { colors } from '../../src/lib/theme'
import { formatearFecha } from '../../src/lib/dates'
import { ApiError } from '../../src/lib/http'
import { configService } from '../../src/services'
import { useConfirm } from '../../src/state/ConfirmContext'

function aValorInput(fecha: string | null): string {
  return fecha ? fecha.slice(0, 10) : ''
}

export default function ConfiguracionAdmin() {
  const insets = useSafeAreaInsets()
  const confirmar = useConfirm()
  const [fechaLimite, setFechaLimite] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const dto = await configService.getFechaLimite()
        if (!activo) return
        setFechaLimite(dto.fechaLimite)
        setValor(aValorInput(dto.fechaLimite))
      } catch (err) {
        if (activo) setError(err instanceof ApiError ? err.message : 'No se pudo cargar la fecha límite.')
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  useEffect(() => cargar(), [cargar])

  // Auto-ocultar el mensaje de éxito a los 3.5s (mismo criterio que la web).
  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(''), 3500)
    return () => clearTimeout(t)
  }, [mensaje])

  async function guardar() {
    const v = valor.trim()
    if (!v) {
      setError('Selecciona una fecha límite.')
      return
    }
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      const dto = await configService.setFechaLimite(v)
      setFechaLimite(dto.fechaLimite)
      setValor(aValorInput(dto.fechaLimite))
      setMensaje('Fecha límite guardada correctamente.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la fecha límite.')
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    if (!(await confirmar('¿Quitar la fecha límite configurada?', { titulo: 'Quitar fecha límite' }))) return
    setError('')
    setMensaje('')
    setGuardando(true)
    try {
      const dto = await configService.setFechaLimite(null)
      setFechaLimite(dto.fechaLimite)
      setValor('')
      setMensaje('Fecha límite eliminada.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar la fecha límite.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerKicker}>Administración</Text>
        <Text style={s.headerTitle}>Configuración</Text>
      </View>

      <Screen>
        {cargando && <Loading label="Cargando configuración…" />}
        {!cargando && (
          <Card style={s.cardSombra}>
            <Text style={s.titulo}>Fecha límite de envío de protocolos</Text>
            <Text style={s.actual}>
              {fechaLimite ? `Fecha límite actual: ${formatearFecha(fechaLimite)}` : 'No hay una fecha límite configurada.'}
            </Text>

            <Field label="Nueva fecha límite">
              <DateField value={valor} onChange={setValor} minimumDate={new Date()} />
            </Field>

            {!!error && <ErrorText>{error}</ErrorText>}
            {!!mensaje && <Text style={s.ok}>{mensaje}</Text>}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title="Quitar" variant="outline" disabled={guardando || !fechaLimite} onPress={quitar} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={guardando ? 'Guardando…' : 'Guardar'} loading={guardando} onPress={guardar} />
              </View>
            </View>
          </Card>
        )}
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerKicker: { fontSize: 12.5, color: colors.slate500 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  titulo: { fontSize: 14, fontWeight: '700', color: colors.navy },
  actual: { fontSize: 13, color: colors.slate500 },
  ok: { fontSize: 13, fontWeight: '600', color: colors.success },
  cardSombra: {
    gap: 14,
    shadowColor: colors.navy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
})
