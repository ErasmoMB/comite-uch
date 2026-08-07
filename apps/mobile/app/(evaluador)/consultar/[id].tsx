// app/(evaluador)/consultar/[id].tsx
//
// Consulta sobre el expediente. En el teléfono es pantalla propia, no un panel
// lateral como en la web: no hay ancho para tener la rúbrica y el chat a la vez.
//
// El historial NO se persiste a propósito: es una herramienta de consulta
// mientras el evaluador revisa, no un registro del expediente.
import { useEffect, useRef, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ErrorText, Loading } from '../../../src/components/ui'
import SelectField from '../../../src/components/SelectField'
import TopBar from '../../../src/components/TopBar'
import { ApiError } from '../../../src/lib/http'
import { colors } from '../../../src/lib/theme'
import { iaService } from '../../../src/services'
import type { DocumentoConsultable } from '../../../src/services/ia.service'

const MORADO = '#6941c6'

interface Mensaje {
  autor: 'evaluador' | 'ia'
  texto: string
  /** Documento sobre el que se preguntó; se muestra para no perder el contexto. */
  documento?: string
}

export default function ConsultarExpediente() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const expedienteId = Number(id)

  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [pregunta, setPregunta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [documentos, setDocumentos] = useState<DocumentoConsultable[]>([])
  const [documentoId, setDocumentoId] = useState<number | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  // El primero de la lista es el proyecto de investigación (el backend lo pone
  // adelante), que es sobre lo que se pregunta casi siempre.
  useEffect(() => {
    let vigente = true
    iaService
      .documentosConsultables(expedienteId)
      .then(docs => {
        if (!vigente) return
        setDocumentos(docs)
        setDocumentoId(docs[0]?.id ?? null)
      })
      // Si la lista falla, el chat sigue sirviendo: sin documento elegido el
      // backend usa el proyecto, igual que antes de que existiera el selector.
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [expedienteId])

  const seleccionado = documentos.find(d => d.id === documentoId)

  async function preguntar() {
    const texto = pregunta.trim()
    if (texto.length < 3 || enviando) return

    setMensajes(prev => [...prev, { autor: 'evaluador', texto, documento: seleccionado?.label }])
    setPregunta('')
    setEnviando(true)
    setError('')
    try {
      const r = await iaService.consultarExpediente(expedienteId, texto, documentoId ?? undefined)
      setMensajes(prev => [...prev, { autor: 'ia', texto: r.respuesta }])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo consultar el expediente.')
    } finally {
      setEnviando(false)
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar titulo="Consultar expediente" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {documentos.length > 0 && (
          <View style={s.selector}>
            <SelectField
              label="Documento"
              titulo="Consultar sobre"
              valor={String(documentoId ?? '')}
              opciones={documentos.map(d => ({ valor: String(d.id), etiqueta: d.label }))}
              onChange={v => setDocumentoId(Number(v))}
            />
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          keyboardShouldPersistTaps="handled"
        >
          {mensajes.length === 0 && !enviando && (
            <View style={s.vacio}>
              <Text style={s.vacioT}>{'✦'} Pregunta sobre un documento</Text>
              <Text style={s.vacioP}>
                Elige arriba el documento del expediente y pregunta sobre su contenido: responde
                citando la sección. Si algo no está en ese documento, te lo dirá en vez de
                inventarlo.
              </Text>
            </View>
          )}

          {mensajes.map((m, i) => (
            <View key={i} style={m.autor === 'evaluador' ? s.msgUser : s.msgIa}>
              {/* Solo en las preguntas y solo si hay de dónde elegir: con un
                  único documento la etiqueta sería ruido en cada burbuja. */}
              {m.autor === 'evaluador' && !!m.documento && documentos.length > 1 && (
                <Text style={s.msgDoc}>{m.documento}</Text>
              )}
              <Text style={m.autor === 'evaluador' ? s.msgUserT : s.msgIaT}>{m.texto}</Text>
            </View>
          ))}

          {enviando && <Loading label="Consultando el expediente…" />}
          {!!error && <ErrorText>{error}</ErrorText>}
        </ScrollView>

        <View style={s.barra}>
          <TextInput
            style={s.input}
            placeholder="Pregunta sobre este expediente…"
            placeholderTextColor={colors.slate400}
            value={pregunta}
            editable={!enviando}
            onChangeText={setPregunta}
            onSubmitEditing={preguntar}
            returnKeyType="send"
            multiline
          />
          <Pressable
            style={[s.enviar, (enviando || pregunta.trim().length < 3) && s.enviarOff]}
            disabled={enviando || pregunta.trim().length < 3}
            onPress={preguntar}
          >
            <Text style={s.enviarT}>{'➤'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  selector: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.lineSoft,
  },
  msgDoc: { color: '#dbeafe', fontSize: 10.5, marginBottom: 3 },

  vacio: {
    backgroundColor: '#f3edff', borderWidth: 1, borderColor: '#e4d6ff',
    borderRadius: 12, padding: 14, gap: 5,
  },
  vacioT: { fontSize: 13.5, fontWeight: '700', color: '#5b3fa0' },
  vacioP: { fontSize: 13, color: colors.slate500, lineHeight: 19 },

  msgUser: {
    alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: colors.primary,
    paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, borderBottomRightRadius: 4,
  },
  msgUserT: { color: '#fff', fontSize: 13.5, lineHeight: 19 },
  msgIa: {
    alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e4d6ff',
    paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, borderBottomLeftRadius: 4,
  },
  msgIaT: { color: colors.slate700, fontSize: 13.5, lineHeight: 20 },

  barra: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.lineSoft,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    borderWidth: 1, borderColor: colors.line, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    fontSize: 14, color: colors.ink, backgroundColor: '#fff',
  },
  enviar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: MORADO,
    alignItems: 'center', justifyContent: 'center',
  },
  enviarOff: { opacity: 0.45 },
  enviarT: { color: '#fff', fontSize: 17 },
})
