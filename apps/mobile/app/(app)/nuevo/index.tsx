// app/(app)/nuevo/index.tsx
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, ErrorText, Field, Input, Loading, Screen, Stepper, TextArea } from '../../../src/components/ui'
import { DocumentoCard, GuiaNombresAlerta, type DocEstado } from '../../../src/components/DocumentoCard'
import { colors } from '../../../src/lib/theme'
import { ApiError } from '../../../src/lib/http'
import { expedientesService } from '../../../src/services'
import { useApp } from '../../../src/state/AppContext'
import type { AutorExpedienteDto, CatalogosDto } from '../../../src/types/api'

const PASOS = ['Datos', 'Docs', 'Enviar']
const TITULO_MIN_CARACTERES = 10

interface AutorForm {
  apellidosNombres: string
  codigoEstudiante: string
  correo: string
  telefono: string
}

export default function NuevoProyecto() {
  const { usuario } = useApp()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // La misma pantalla sirve para crear y para retomar un borrador
  // (`/(app)/nuevo?id=123`). Antes, apenas se guardaba el borrador los campos
  // quedaban congelados para siempre: si un integrante había quedado sin
  // teléfono, el expediente ya no se podía completar NI enviar.
  const params = useLocalSearchParams<{ id?: string }>()
  const expedienteIdRuta = params.id ? Number(params.id) : null

  const [catalogos, setCatalogos] = useState<CatalogosDto | null>(null)
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)
  const [errorCatalogos, setErrorCatalogos] = useState('')

  const [paso, setPaso] = useState(0)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [creando, setCreando] = useState(false)
  const [enviandoFinal, setEnviandoFinal] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [programa, setPrograma] = useState('')
  const [ciclo, setCiclo] = useState('')
  const [nivelPosgrado, setNivelPosgrado] = useState('')
  const [autores, setAutores] = useState<AutorForm[]>([
    {
      apellidosNombres: usuario ? `${usuario.apellidos}, ${usuario.nombres}` : '',
      codigoEstudiante: usuario?.codigo ?? '',
      correo: usuario?.correo ?? '',
      telefono: '',
    },
  ])

  const [expedienteId, setExpedienteId] = useState<number | null>(expedienteIdRuta)
  const [docsEstado, setDocsEstado] = useState<Record<string, DocEstado>>({})

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const res = await expedientesService.getCatalogos()
        if (!activo) return
        setCatalogos(res)

        if (!expedienteIdRuta) {
          setPrograma(res.programasEstudios?.[0] ?? '')
          setCiclo(res.ciclos?.[0] ?? '')
          setNivelPosgrado(res.nivelesPosgrado?.[0] ?? '')
          return
        }

        // Modo edición: se rellena el formulario con lo ya guardado.
        const expediente = await expedientesService.getById(expedienteIdRuta)
        if (!activo) return
        setTitulo(expediente.tituloProtocolo ?? '')
        setPrograma(expediente.programaEstudios || res.programasEstudios?.[0] || '')
        setCiclo(expediente.ciclo || res.ciclos?.[0] || '')
        setNivelPosgrado(expediente.nivelPosgrado || res.nivelesPosgrado?.[0] || '')
        if (expediente.autores && expediente.autores.length > 0) {
          setAutores(
            [...expediente.autores]
              .sort((a, b) => a.orden - b.orden)
              .map(a => ({
                apellidosNombres: a.apellidosNombres ?? '',
                codigoEstudiante: a.codigoEstudiante ?? '',
                correo: a.correo ?? '',
                telefono: a.telefono ?? '',
              })),
          )
        }
      } catch (err) {
        if (activo) setErrorCatalogos(err instanceof ApiError ? err.message : 'No se pudieron cargar los datos.')
      } finally {
        if (activo) setCargandoCatalogos(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [expedienteIdRuta])

  const modalidad = catalogos?.modalidad ?? null
  const esPregrado = modalidad === 'pregrado'
  const esPostgrado = modalidad === 'postgrado'
  const esInterno = modalidad === 'interno'
  const esEstudiante = esPregrado || esPostgrado
  const docsRequeridos = (modalidad && catalogos?.documentosRequeridos[modalidad]) || []

  // El Comité diferencia: estudiantes suman "autores"; investigadores, "coautores".
  const autorTermCap = esInterno ? 'Coautor' : 'Autor'
  const autorPrincipalLabel = esInterno ? 'Investigador principal' : 'Autor principal'
  const coautoresLabel = esInterno ? 'Coautores' : 'Autores adicionales'
  const agregarAutorLabel = esInterno ? '+ Agregar coautor' : '+ Agregar autor'

  function actualizarAutor(index: number, campo: keyof AutorForm, valor: string) {
    setAutores(prev => prev.map((a, i) => (i === index ? { ...a, [campo]: valor } : a)))
  }

  function agregarCoautor() {
    setAutores(prev => [...prev, { apellidosNombres: '', codigoEstudiante: '', correo: '', telefono: '' }])
  }

  function quitarCoautor(index: number) {
    setAutores(prev => prev.filter((_, i) => i !== index))
  }

  /**
   * Guarda el paso 1: crea el borrador la primera vez y lo actualiza en cada
   * guardado posterior. Devuelve `true` si quedó guardado.
   */
  async function guardarDatos(): Promise<boolean> {
    if (titulo.trim().length < TITULO_MIN_CARACTERES) {
      setError(`El título debe tener al menos ${TITULO_MIN_CARACTERES} caracteres.`)
      return false
    }
    if (!autores[0]?.apellidosNombres.trim()) {
      setError(`El ${autorPrincipalLabel.toLowerCase()} necesita apellidos y nombres.`)
      return false
    }
    setError('')
    setMensaje('')
    setCreando(true)
    try {
      const autoresPayload: AutorExpedienteDto[] = autores.map((a, i) => ({
        orden: i + 1,
        apellidosNombres: a.apellidosNombres.trim(),
        codigoEstudiante: a.codigoEstudiante.trim() || null,
        correo: a.correo.trim() || null,
        telefono: a.telefono.trim() || null,
        esPrincipal: i === 0,
      }))
      const datos = {
        tituloProtocolo: titulo.trim(),
        programaEstudios: programa || undefined,
        ciclo: esPregrado ? ciclo : undefined,
        nivelPosgrado: esPostgrado ? nivelPosgrado : undefined,
        autores: autoresPayload,
      }
      if (expedienteId) {
        await expedientesService.update(expedienteId, datos)
        setMensaje('Datos guardados.')
      } else {
        const nuevo = await expedientesService.create({ ...datos, tipoTramite: 'proyecto_nuevo' })
        setExpedienteId(nuevo.id)
        setDocsEstado(Object.fromEntries(docsRequeridos.map(d => [d.tipo, { cargado: false, subiendo: false }])))
      }
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el borrador.')
      return false
    } finally {
      setCreando(false)
    }
  }

  async function siguientePaso1() {
    if (await guardarDatos()) {
      setPaso(1)
    }
  }

  // TODO Fase posterior: expo-document-picker — hasta integrar la subida real,
  // no se bloquea el avance del wizard aunque falten documentos por cargar.
  function continuarDocs() {
    setError('')
    setPaso(2)
  }

  async function enviarFinal() {
    if (!expedienteId) return
    // Los datos pueden haber cambiado desde el último guardado (justamente el
    // caso de "me faltó el teléfono"): se guardan antes de enviar.
    if (!(await guardarDatos())) return
    setEnviandoFinal(true)
    setError('')
    try {
      const res = await expedientesService.enviar(expedienteId)
      router.replace({ pathname: '/(app)/nuevo/exito', params: { codigo: res.codigo ?? '', id: String(expedienteId) } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el proyecto.')
    } finally {
      setEnviandoFinal(false)
    }
  }

  // Devuelve JSX en vez de ser un componente declarado dentro del render: si
  // fuera un componente, React lo trataría como un tipo nuevo en cada render y
  // remontaría los <Input>, que perderían el foco a cada tecla.
  function camposAutor(index: number) {
    const a = autores[index]
    if (!a) return null
    return (
      <>
        <Input
          placeholder="Apellidos, nombres"
          value={a.apellidosNombres}
          onChangeText={v => actualizarAutor(index, 'apellidosNombres', v)}
        />
        {/* Código y correo van apilados, no lado a lado: a media pantalla
            de teléfono un correo institucional no entra y se veía cortado
            por la izquierda ("regrado@uch.edu.pe"). */}
        {esEstudiante && (
          <Input
            placeholder="Código"
            value={a.codigoEstudiante}
            onChangeText={v => actualizarAutor(index, 'codigoEstudiante', v)}
          />
        )}
        <Input
          placeholder="Correo"
          autoCapitalize="none"
          keyboardType="email-address"
          value={a.correo}
          onChangeText={v => actualizarAutor(index, 'correo', v)}
        />
        <Input
          placeholder="Teléfono"
          keyboardType="phone-pad"
          value={a.telefono}
          onChangeText={v => actualizarAutor(index, 'telefono', v)}
        />
      </>
    )
  }

  function cancelar() {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(app)')
    }
  }

  const tituloHeader =
    paso === 1 ? 'Documentos' : paso === 2 ? 'Enviar' : expedienteIdRuta ? 'Editar borrador' : 'Nuevo proyecto'

  if (cargandoCatalogos) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}><Text style={s.headerTitle}>{tituloHeader}</Text></View>
        <Loading label="Cargando…" />
      </View>
    )
  }

  if (errorCatalogos) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}><Text style={s.headerTitle}>{tituloHeader}</Text></View>
        <Screen><ErrorText>{errorCatalogos}</ErrorText></Screen>
      </View>
    )
  }

  if (!modalidad) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}><Text style={s.headerTitle}>{tituloHeader}</Text></View>
        <Screen><Text style={s.muted}>Tu rol no puede enviar proyectos al comité de ética.</Text></Screen>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <Text style={s.headerTitle}>{tituloHeader}</Text>
      </View>
      <Stepper pasos={PASOS} actual={paso} />

      {paso === 0 && (
        <Screen>
          <Field label="Título del proyecto">
            <TextArea
              placeholder="Efectos del mindfulness en la ansiedad…"
              value={titulo}
              onChangeText={setTitulo}
            />
          </Field>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Selector
                label="Programa"
                value={programa}
                opciones={catalogos?.programasEstudios ?? []}
                onChange={setPrograma}
              />
            </View>
          </View>
          {esPregrado && (
            <Selector
              label="Ciclo"
              value={ciclo}
              opciones={catalogos?.ciclos ?? []}
              onChange={setCiclo}
            />
          )}
          {esPostgrado && (
            <Selector
              label="Nivel de posgrado"
              value={nivelPosgrado}
              opciones={catalogos?.nivelesPosgrado ?? []}
              onChange={setNivelPosgrado}
            />
          )}

          {/* El investigador/autor principal va en su PROPIO contenedor: el
              Comité observó que tenerlo dentro de la caja de "Coautores" se
              prestaba a confusión. */}
          <View style={s.autoresHeader}>
            <Text style={s.autoresTitulo}>{autorPrincipalLabel}</Text>
          </View>
          <Card style={{ gap: 8 }}>{camposAutor(0)}</Card>

          <View style={s.autoresHeader}>
            <Text style={s.autoresTitulo}>{coautoresLabel}</Text>
            <Pressable onPress={agregarCoautor} hitSlop={6}>
              <Text style={s.link}>{agregarAutorLabel}</Text>
            </Pressable>
          </View>

          {autores.length === 1 && (
            <Text style={s.muted}>
              {esInterno
                ? 'Aún no agregaste coautores. Si el proyecto es individual, puedes continuar.'
                : 'Aún no agregaste otros autores. Si el proyecto es individual, puedes continuar.'}
            </Text>
          )}

          {autores.slice(1).map((_, i) => {
            const index = i + 1
            return (
              <Card key={index} style={{ gap: 8 }}>
                <View style={s.autorCardHeader}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{`${autorTermCap} ${index + 1}`}</Text>
                  </View>
                  <Pressable onPress={() => quitarCoautor(index)} hitSlop={6}>
                    <Text style={s.linkDanger}>Quitar</Text>
                  </Pressable>
                </View>
                {camposAutor(index)}
              </Card>
            )
          })}

          <Pressable onPress={agregarCoautor} style={s.dashedBtn}>
            <Text style={s.dashedBtnText}>{agregarAutorLabel}</Text>
          </Pressable>

          <ErrorText>{error}</ErrorText>
          {!!mensaje && !error && <Text style={s.okText}>{mensaje}</Text>}

          <View style={s.btnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" variant="outline" onPress={cancelar} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={creando ? 'Guardando…' : 'Guardar y continuar'} loading={creando} onPress={siguientePaso1} />
            </View>
          </View>
        </Screen>
      )}

      {paso === 1 && (
        <Screen>
          <Text style={s.seccionTitulo}>Documentos requeridos</Text>

          {catalogos?.guiaNombres && <GuiaNombresAlerta guia={catalogos.guiaNombres} />}

          <View style={s.avisoProximamente}>
            <Text style={s.avisoTexto}>La carga de archivos estará disponible próximamente.</Text>
          </View>

          {docsRequeridos.map(d => (
            <DocumentoCard
              key={d.tipo}
              doc={d}
              estado={docsEstado[d.tipo]}
              disabled={!!docsEstado[d.tipo]?.subiendo}
            />
          ))}

          <ErrorText>{error}</ErrorText>

          <View style={s.btnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Atrás" variant="outline" onPress={() => setPaso(0)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Siguiente" onPress={continuarDocs} />
            </View>
          </View>
        </Screen>
      )}

      {paso === 2 && (
        <Screen>
          <Card>
            <Text style={s.muted}>Revisa antes de enviar</Text>
            <Text style={s.resumenTitulo}>{titulo}</Text>
            <Text style={s.muted}>
              {esPregrado && `${programa} · Ciclo ${ciclo}`}
              {esPostgrado && `${programa} · ${nivelPosgrado}`}
              {!esPregrado && !esPostgrado && programa}
            </Text>
          </Card>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {docsRequeridos.map(d => {
              const cargado = !!docsEstado[d.tipo]?.cargado
              return (
                <View key={d.tipo} style={s.checklistRow}>
                  <View style={s.checklistLeft}>
                    <View style={[s.dot, cargado ? s.dotOn : s.dotOff]}>
                      <Text style={[s.dotText, cargado && { color: '#fff' }]}>{cargado ? '✓' : '–'}</Text>
                    </View>
                    <Text numberOfLines={1} style={s.checklistNombre}>{d.label}</Text>
                  </View>
                  <View style={[s.badge, cargado ? { backgroundColor: colors.successBg } : { backgroundColor: colors.chipBg }]}>
                    <Text style={[s.badgeText, { color: cargado ? colors.success : colors.slate500 }]}>
                      {cargado ? 'Listo' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              )
            })}
          </Card>

          <Text style={s.muted}>
            Al enviar, tu proyecto pasará a revisión administrativa y recibirás notificaciones sobre su avance.
          </Text>

          <ErrorText>{error}</ErrorText>

          <View style={s.btnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Atrás" variant="outline" onPress={() => setPaso(1)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={enviandoFinal ? 'Enviando…' : 'Enviar proyecto'} loading={enviandoFinal} onPress={enviarFinal} />
            </View>
          </View>
        </Screen>
      )}
    </View>
  )
}

function Selector({
  label,
  value,
  opciones,
  onChange,
  disabled,
}: {
  label: string
  value: string
  opciones: string[]
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <Field label={label}>
      <View style={s.segment}>
        {opciones.map(op => (
          <Pressable
            key={op}
            disabled={disabled}
            onPress={() => onChange(op)}
            style={[s.segItem, value === op && s.segItemActive, disabled && s.segItemDisabled]}
          >
            <Text style={[s.segText, value === op && s.segTextActive]}>{op}</Text>
          </Pressable>
        ))}
      </View>
    </Field>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 13, color: colors.slate500 },
  okText: { fontSize: 13, fontWeight: '600', color: colors.success },
  seccionTitulo: { fontSize: 13, fontWeight: '700', color: colors.navy },
  link: { fontSize: 13, fontWeight: '600', color: colors.primary },
  linkDanger: { fontSize: 13, fontWeight: '600', color: colors.danger },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segItemDisabled: { opacity: 0.5 },
  segText: { fontSize: 12.5, color: colors.slate500, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  autoresHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  autoresTitulo: { fontSize: 13.5, fontWeight: '700', color: colors.navy },
  autorCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.blue50 },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  dashedBtn: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  dashedBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  avisoProximamente: { backgroundColor: colors.warnBg, borderRadius: 10, padding: 11 },
  avisoTexto: { fontSize: 12.5, color: colors.warn, fontWeight: '500' },
  resumenTitulo: { fontSize: 15, fontWeight: '700', color: colors.ink, marginVertical: 8 },
  checklistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  checklistLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  checklistNombre: { fontSize: 13, fontWeight: '500', color: colors.ink, flexShrink: 1 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.success },
  dotOff: { backgroundColor: colors.chipBg },
  dotText: { fontSize: 10, fontWeight: '700', color: colors.slate400 },
})
