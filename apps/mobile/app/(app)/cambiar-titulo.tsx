// app/(app)/cambiar-titulo.tsx
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, Card, ErrorText, Field, Input, Loading, Screen, Stepper, TextArea } from '../../src/components/ui'
import { DocumentoCard, type DocEstado } from '../../src/components/DocumentoCard'
import TopBar from '../../src/components/TopBar'
import { colors } from '../../src/lib/theme'
import { ApiError } from '../../src/lib/http'
import { expedientesService } from '../../src/services'
import { useConfirm } from '../../src/state/ConfirmContext'
import type { AutorExpedienteDto, ElegibleCambioTituloDto, TipoDocumentoInfo } from '../../src/types/api'

const PASOS = ['Datos e integrantes', 'Documento', 'Revisar y enviar']
const TITULO_MIN_CARACTERES = 5

interface AutorForm {
  apellidosNombres: string
  codigoEstudiante: string
  correo: string
}

const AUTOR_VACIO: AutorForm = { apellidosNombres: '', codigoEstudiante: '', correo: '' }

export default function CambiarTitulo() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const idPreseleccionado = Number(id)
  const confirmar = useConfirm()

  const [elegibles, setElegibles] = useState<ElegibleCambioTituloDto[]>([])
  const [programas, setProgramas] = useState<string[]>([])
  const [ciclos, setCiclos] = useState<string[]>([])
  const [modalidad, setModalidad] = useState<string | null>(null)
  const [documentoInfo, setDocumentoInfo] = useState<TipoDocumentoInfo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [origenId, setOrigenId] = useState<number | ''>('')
  const [tituloNuevo, setTituloNuevo] = useState('')
  const [programa, setPrograma] = useState('')
  const [ciclo, setCiclo] = useState('')
  const [autores, setAutores] = useState<AutorForm[]>([AUTOR_VACIO])

  const [paso, setPaso] = useState<'datos' | 'documento' | 'revisar'>('datos')
  const [error, setError] = useState('')
  const [expedienteId, setExpedienteId] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)

  const esInterno = modalidad === 'interno'
  const esEstudiante = !esInterno
  const autorTermCap = esInterno ? 'Coautor' : 'Autor'
  const autorPrincipalLabel = esInterno ? 'Investigador principal' : 'Autor principal'
  const agregarAutorLabel = esInterno ? '+ Agregar coautor' : '+ Agregar autor'

  function aplicarOrigen(e: ElegibleCambioTituloDto, programasOverride?: string[], ciclosOverride?: string[]) {
    const programasActuales = programasOverride ?? programas
    const ciclosActuales = ciclosOverride ?? ciclos
    setOrigenId(e.id)
    setTituloNuevo(e.titulo)
    setPrograma(e.programaEstudios || programasActuales[0] || '')
    setCiclo(e.ciclo && ciclosActuales.includes(e.ciclo) ? e.ciclo : ciclosActuales[0] || '')
    setAutores(
      e.autores.length > 0
        ? e.autores.map(a => ({ apellidosNombres: a.apellidosNombres, codigoEstudiante: a.codigoEstudiante, correo: a.correo }))
        : [AUTOR_VACIO],
    )
  }

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const [elegiblesRes, catalogosRes] = await Promise.all([
          expedientesService.getElegiblesCambioTitulo(),
          expedientesService.getCatalogos(),
        ])
        if (!activo) return
        const programasFrescos = catalogosRes.programasEstudios ?? []
        const ciclosFrescos = catalogosRes.cambioTitulo?.ciclos ?? []
        setElegibles(elegiblesRes)
        setProgramas(programasFrescos)
        setCiclos(ciclosFrescos)
        setModalidad(catalogosRes.modalidad)
        setDocumentoInfo(catalogosRes.cambioTitulo?.documento ?? null)
        const preseleccionado = elegiblesRes.find(e => e.id === idPreseleccionado)
        if (preseleccionado) aplicarOrigen(preseleccionado, programasFrescos, ciclosFrescos)
      } catch (err) {
        if (activo) setErrorCarga(err instanceof ApiError ? err.message : 'No se pudieron cargar los proyectos elegibles.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPreseleccionado])

  function actualizarAutor(index: number, campo: keyof AutorForm, valor: string) {
    setAutores(prev => prev.map((a, i) => (i === index ? { ...a, [campo]: valor } : a)))
  }

  function agregarAutor() {
    setAutores(prev => [...prev, { ...AUTOR_VACIO }])
  }

  function quitarAutor(index: number) {
    setAutores(prev => prev.filter((_, i) => i !== index))
  }

  const origen = elegibles.find(e => e.id === origenId) ?? null

  function siguienteDatos() {
    if (origenId === '') {
      setError('Selecciona el proyecto aprobado que deseas modificar.')
      return
    }
    if (tituloNuevo.trim().length < TITULO_MIN_CARACTERES) {
      setError(`Ingresa el nuevo título (mínimo ${TITULO_MIN_CARACTERES} caracteres).`)
      return
    }
    if (!programa || !ciclo) {
      setError('Selecciona el programa y el ciclo.')
      return
    }
    for (let i = 0; i < autores.length; i++) {
      const a = autores[i]
      const etiqueta = i === 0 ? autorPrincipalLabel : `${autorTermCap} ${i + 1}`
      if (!a.apellidosNombres.trim()) return setError(`${etiqueta}: falta apellidos y nombres.`)
      if (esEstudiante && !a.codigoEstudiante.trim()) return setError(`${etiqueta}: falta código de estudiante.`)
      if (!a.correo.trim()) return setError(`${etiqueta}: falta correo.`)
    }
    setError('')
    setPaso('documento')
  }

  // TODO Fase posterior: expo-document-picker — hasta integrar la subida real, no se
  // bloquea el avance del wizard aunque falte el documento por cargar (igual que NuevoProyecto).
  function continuarDocumento() {
    setError('')
    setPaso('revisar')
  }

  async function confirmarEnvio() {
    if (!origen) return
    if (
      !(await confirmar('Se remitirá al Comité de Ética y dejará de ser editable. ¿Deseas enviarla?', {
        titulo: 'Enviar solicitud de cambio de título',
        textoConfirmar: 'Enviar al Comité',
      }))
    )
      return
    setEnviando(true)
    setError('')
    try {
      let expId = expedienteId
      if (!expId) {
        const autoresPayload: AutorExpedienteDto[] = autores.map((a, i) => ({
          orden: i + 1,
          apellidosNombres: a.apellidosNombres.trim(),
          codigoEstudiante: a.codigoEstudiante.trim() || null,
          correo: a.correo.trim() || null,
          telefono: null,
          esPrincipal: i === 0,
        }))
        const nuevo = await expedientesService.createCambioTitulo({
          proyectoOrigenId: origen.id,
          programaEstudios: programa,
          ciclo,
          tituloNuevo: tituloNuevo.trim(),
          autores: autoresPayload,
        })
        expId = nuevo.id
        setExpedienteId(expId)
      }
      // TODO Fase posterior: expo-document-picker — cuando exista archivo real, llamar
      // expedientesService.registrarDocumento(expId, file, { tipoDocumento: documentoInfo.tipo, esObligatorio: true })
      // antes de enviar. Sin subida, no hay archivo que registrar en este corte.
      await expedientesService.enviar(expId)
      router.replace(`/(app)/proyectos/${expId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud de cambio de título.')
    } finally {
      setEnviando(false)
    }
  }

  function cancelar() {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(app)/proyectos')
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Cambiar título" />
        <Loading label="Cargando proyectos elegibles…" />
      </View>
    )
  }

  if (errorCarga) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Cambiar título" />
        <Screen>
          <ErrorText>{errorCarga}</ErrorText>
        </Screen>
      </View>
    )
  }

  if (elegibles.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar titulo="Cambiar título" />
        <Screen>
          <Text style={s.muted}>
            No tienes proyectos aprobados. Solo puedes solicitar un cambio de título sobre un proyecto ya aprobado (con o
            sin observaciones).
          </Text>
          <Button title="Volver a mis proyectos" variant="outline" onPress={() => router.replace('/(app)/proyectos')} />
        </Screen>
      </View>
    )
  }

  const estadoDocumento: DocEstado = { cargado: false, subiendo: false }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Cambiar título" />
      <Stepper pasos={PASOS} actual={paso === 'datos' ? 0 : paso === 'documento' ? 1 : 2} />

      {paso === 'datos' && (
        <Screen>
          <Field label="Proyecto de origen">
            <View style={{ gap: 8 }}>
              {elegibles.map(e => {
                const seleccionado = e.id === origenId
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => aplicarOrigen(e)}
                    style={[s.origenItem, seleccionado && s.origenItemActive]}
                  >
                    <Text style={[s.origenTexto, seleccionado && s.origenTextoActive]} numberOfLines={2}>
                      {e.codigo ?? '—'} · {e.titulo}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </Field>

          {origen && (
            <>
              <View style={s.origenInfo}>
                <Text style={s.origenInfoTitulo}>Proyecto aprobado · {origen.codigo ?? '—'}</Text>
                <Text style={s.origenInfoTexto}>Título actual: {origen.titulo}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Selector label="Programa" value={programa} opciones={programas} onChange={setPrograma} />
                </View>
                <View style={{ flex: 1 }}>
                  <Selector label="Ciclo" value={ciclo} opciones={ciclos} onChange={setCiclo} />
                </View>
              </View>

              <Field label="Nuevo título">
                <TextArea placeholder="Escribe el nuevo título propuesto" value={tituloNuevo} onChangeText={setTituloNuevo} />
              </Field>

              <View style={s.autoresHeader}>
                <Text style={s.autoresTitulo}>{esInterno ? 'Coautores' : 'Autores'}</Text>
                <Pressable onPress={agregarAutor} hitSlop={6}>
                  <Text style={s.link}>{agregarAutorLabel}</Text>
                </Pressable>
              </View>

              {autores.map((a, i) => (
                <Card key={i} style={{ gap: 8 }}>
                  <View style={s.autorCardHeader}>
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{i === 0 ? autorPrincipalLabel : `${autorTermCap} ${i + 1}`}</Text>
                    </View>
                    {i > 0 && (
                      <Pressable onPress={() => quitarAutor(i)} hitSlop={6}>
                        <Text style={s.linkDanger}>Quitar</Text>
                      </Pressable>
                    )}
                  </View>
                  <Input
                    placeholder="Apellidos, nombres"
                    value={a.apellidosNombres}
                    onChangeText={v => actualizarAutor(i, 'apellidosNombres', v)}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {esEstudiante && (
                      <View style={{ flex: 1 }}>
                        <Input
                          placeholder="Código"
                          value={a.codigoEstudiante}
                          onChangeText={v => actualizarAutor(i, 'codigoEstudiante', v)}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Input
                        placeholder="Correo"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={a.correo}
                        onChangeText={v => actualizarAutor(i, 'correo', v)}
                      />
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}

          <ErrorText>{error}</ErrorText>

          <View style={s.btnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" variant="outline" onPress={cancelar} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Continuar a documento" onPress={siguienteDatos} />
            </View>
          </View>
        </Screen>
      )}

      {paso === 'documento' && documentoInfo && (
        <Screen>
          <View style={s.avisoProximamente}>
            <Text style={s.avisoTexto}>La carga de archivos estará disponible próximamente.</Text>
          </View>

          <DocumentoCard doc={documentoInfo} estado={estadoDocumento} disabled />

          <ErrorText>{error}</ErrorText>

          <View style={s.btnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Atrás" variant="outline" onPress={() => setPaso('datos')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Continuar a revisión" onPress={continuarDocumento} />
            </View>
          </View>
        </Screen>
      )}

      {paso === 'revisar' && origen && (
        <Screen>
          <Text style={s.seccionTitulo}>Confirma la solicitud de cambio de título</Text>
          <Card style={{ gap: 4 }}>
            <Text style={s.muted}>Título anterior</Text>
            <Text style={s.valorSecundario}>{origen.titulo}</Text>
            <Text style={s.muted}>Nuevo título</Text>
            <Text style={s.valorPrincipal}>{tituloNuevo}</Text>
            <Text style={s.muted}>{esInterno ? 'Coautores' : 'Autores'}</Text>
            <Text style={s.valorSecundario}>{autores.length}</Text>
            <Text style={s.muted}>Documento</Text>
            <View style={[s.badge, { alignSelf: 'flex-start', backgroundColor: colors.chipBg }]}>
              <Text style={[s.badgeText, { color: colors.slate500 }]}>Pendiente (carga disponible próximamente)</Text>
            </View>
          </Card>
          <Text style={s.muted}>
            Se creará una nueva solicitud vinculada al proyecto {origen.codigo ?? '—'} y se enviará directamente al Comité
            de Ética. No podrás editarla después.
          </Text>
          <ErrorText>{error}</ErrorText>
          <View style={s.btnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Atrás" variant="outline" onPress={() => setPaso('documento')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={enviando ? 'Enviando…' : 'Enviar al Comité'} loading={enviando} onPress={confirmarEnvio} />
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
}: {
  label: string
  value: string
  opciones: string[]
  onChange: (v: string) => void
}) {
  return (
    <Field label={label}>
      <View style={s.segment}>
        {opciones.map(op => (
          <Pressable key={op} onPress={() => onChange(op)} style={[s.segItem, value === op && s.segItemActive]}>
            <Text style={[s.segText, value === op && s.segTextActive]}>{op}</Text>
          </Pressable>
        ))}
      </View>
    </Field>
  )
}

const s = StyleSheet.create({
  muted: { fontSize: 13, color: colors.slate500 },
  seccionTitulo: { fontSize: 14, fontWeight: '700', color: colors.navy },
  link: { fontSize: 13, fontWeight: '600', color: colors.primary },
  linkDanger: { fontSize: 13, fontWeight: '600', color: colors.danger },
  origenItem: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fff' },
  origenItemActive: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.blue50 },
  origenTexto: { fontSize: 13, color: colors.slate700 },
  origenTextoActive: { color: colors.primary, fontWeight: '600' },
  origenInfo: { backgroundColor: colors.blue50, borderWidth: 1, borderColor: colors.blue100, borderRadius: 10, padding: 12 },
  origenInfoTitulo: { fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: 2 },
  origenInfoTexto: { fontSize: 12.5, color: colors.slate700 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  segItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 12.5, color: colors.slate500, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  autoresHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  autoresTitulo: { fontSize: 13.5, fontWeight: '700', color: colors.navy },
  autorCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.blue50 },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  avisoProximamente: { backgroundColor: colors.warnBg, borderRadius: 10, padding: 11 },
  avisoTexto: { fontSize: 12.5, color: colors.warn, fontWeight: '500' },
  valorPrincipal: { fontSize: 13.5, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  valorSecundario: { fontSize: 13, color: colors.slate700, marginBottom: 4 },
})
