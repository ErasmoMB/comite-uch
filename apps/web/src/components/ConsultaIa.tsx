import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/http'
import { iaService } from '../services'
import type { DocumentoConsultable } from '../services/ia.service'

interface Mensaje {
  autor: 'evaluador' | 'ia'
  texto: string
  /** Documento sobre el que se preguntó; se muestra para no perder el contexto. */
  documento?: string
}

/**
 * Panel de consulta sobre el expediente.
 *
 * El historial NO se persiste a propósito: es una herramienta de consulta del
 * evaluador mientras revisa, no un registro del expediente. Vive lo que dura la
 * pantalla.
 */
export default function ConsultaIa({ expedienteId }: { expedienteId: number }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [pregunta, setPregunta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [documentos, setDocumentos] = useState<DocumentoConsultable[]>([])
  const [documentoId, setDocumentoId] = useState<number | null>(null)
  const finRef = useRef<HTMLDivElement>(null)

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
      // El texto de la pregunta ya se consumió; el error va aparte para que el
      // evaluador vea qué pasó sin perder el hilo de la conversación.
      setError(e instanceof ApiError ? e.message : 'No se pudo consultar el expediente.')
    } finally {
      setEnviando(false)
      requestAnimationFrame(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }))
    }
  }

  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--purple)', fontSize: 14 }}>✦</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }}>Consultar el expediente</span>
      </div>

      {mensajes.length === 0 && !enviando && (
        <p className="small muted" style={{ margin: 0, lineHeight: 1.55 }}>
          Elige un documento del expediente y pregunta sobre su contenido: te responde citando la
          sección. Si algo no está en ese documento, te lo dirá.
        </p>
      )}

      {documentos.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="small muted" style={{ flex: 'none' }}>Documento</span>
          <select
            className="input"
            // Igual que el campo de texto: sin minWidth:0 el select conserva su
            // ancho intrínseco (el de la opción más larga) y desborda la fila.
            style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: '6px 8px' }}
            value={documentoId ?? ''}
            disabled={enviando}
            onChange={e => setDocumentoId(Number(e.target.value))}
          >
            {documentos.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
      )}

      {mensajes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 320, overflowY: 'auto' }}>
          {mensajes.map((m, i) => (
            <div
              key={i}
              style={
                m.autor === 'evaluador'
                  ? {
                      alignSelf: 'flex-end', maxWidth: '88%',
                      background: 'var(--primary)', color: '#fff',
                      padding: '9px 12px', borderRadius: 12, borderBottomRightRadius: 4,
                      fontSize: 13, lineHeight: 1.5,
                    }
                  : {
                      alignSelf: 'flex-start', maxWidth: '92%',
                      background: '#fff', color: 'var(--slate-700)',
                      border: '1px solid var(--purple-line)',
                      padding: '9px 12px', borderRadius: 12, borderBottomLeftRadius: 4,
                      fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                    }
              }
            >
              {/* Solo en las preguntas y solo si hay de dónde elegir: con un
                  único documento la etiqueta sería ruido en cada burbuja. */}
              {m.autor === 'evaluador' && m.documento && documentos.length > 1 && (
                <div style={{ fontSize: 10.5, opacity: 0.85, marginBottom: 3 }}>{m.documento}</div>
              )}
              {m.texto}
            </div>
          ))}
          {enviando && (
            <div className="small muted" style={{ alignSelf: 'flex-start' }}>Consultando el expediente…</div>
          )}
          <div ref={finRef} />
        </div>
      )}

      {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          // minWidth:0 es necesario para que el input pueda encogerse dentro
          // del flex; sin eso conserva su ancho intrínseco y desborda la fila.
          style={{ flex: 1, minWidth: 0 }}
          placeholder="Pregunta sobre este expediente…"
          value={pregunta}
          disabled={enviando}
          onChange={e => setPregunta(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              preguntar()
            }
          }}
        />
        <button
          className="btn"
          // `.btn` trae width:100%; hay que anularlo para que no se coma la
          // fila entera y deje sin espacio al campo de texto.
          style={{
            background: 'var(--purple)', color: '#fff', border: 'none',
            width: 48, flex: 'none', padding: 0, fontSize: 16,
          }}
          aria-label="Enviar pregunta"
          disabled={enviando || pregunta.trim().length < 3}
          onClick={preguntar}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
