import type { ChangeEvent } from 'react'
import { formatoDocumento, MAX_SIZE_MB } from '../lib/documentFormats'
import { plantillaUrl } from '../lib/http'
import type { GuiaNombresDto, TipoDocumentoInfo } from '../types/api'

export interface DocEstado {
  cargado: boolean
  nombreArchivo?: string
  subiendo: boolean
  error?: string
}

export function GuiaNombresAlerta({ guia }: { guia: GuiaNombresDto }) {
  return (
    <div style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-100)', borderRadius: 11, padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ fontSize: 12.5, color: 'var(--primary)' }}>📂 Nombre de los archivos (importante)</strong>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--slate-700)' }}>{guia.texto}</p>
      <button
        type="button"
        className="link"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => window.open(plantillaUrl(guia.key, 'ver'), '_blank', 'noopener,noreferrer')}
      >
        Ver guía
      </button>
    </div>
  )
}

// Tarjeta de documento requerido: formato/peso, indicaciones colapsables,
// plantilla/guía descargable, y control de archivo. Sirve tanto para subida
// inmediata (nuevo proyecto, con expediente ya creado) como para "guardar
// localmente antes de crear el expediente" (cambio de título) — el
// componente no sabe ni le importa qué hace `onFile`, solo refleja `estado`.
export function DocumentoCard({
  doc,
  estado,
  disabled,
  onFile,
}: {
  doc: TipoDocumentoInfo
  estado: DocEstado | undefined
  disabled: boolean
  onFile: (file: File) => void
}) {
  const formato = formatoDocumento(doc.tipo)
  const cargado = !!estado?.cargado

  function seleccionar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onFile(file)
  }

  return (
    <div className="card" style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{doc.label}</div>
        <span className={`badge ${cargado ? 'badge-aprobado' : 'badge-borrador'}`} style={{ flex: 'none' }}>
          {cargado ? 'Cargado' : 'Pendiente'}
        </span>
      </div>

      <p className="small muted" style={{ margin: 0 }}>
        Formato: {formato.label} · Máx {MAX_SIZE_MB} MB
      </p>

      {doc.indicaciones.length > 0 && (
        <details className="small" style={{ color: 'var(--slate-500)' }}>
          <summary className="link" style={{ cursor: 'pointer' }}>
            Ver indicaciones
          </summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {doc.indicaciones.map(ind => (
              <li key={ind}>{ind}</li>
            ))}
          </ul>
        </details>
      )}

      {doc.plantilla && (
        <div>
          {doc.plantilla.accion === 'descargar' ? (
            <a className="link" href={plantillaUrl(doc.plantilla.key, 'descargar')} target="_blank" rel="noopener noreferrer">
              ⬇ {doc.plantilla.label}
            </a>
          ) : (
            <button
              type="button"
              className="link"
              onClick={() => window.open(plantillaUrl(doc.plantilla!.key, 'ver'), '_blank', 'noopener,noreferrer')}
            >
              👁 {doc.plantilla.label}
            </button>
          )}
        </div>
      )}

      {cargado ? (
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '9px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span className="small" style={{ color: 'var(--slate-700)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {estado?.nombreArchivo}
          </span>
          <label className="link" style={{ cursor: 'pointer', flex: 'none' }}>
            Cambiar
            <input type="file" style={{ display: 'none' }} onChange={seleccionar} />
          </label>
        </div>
      ) : (
        <label className="upload-dash primary" style={{ cursor: disabled || estado?.subiendo ? 'default' : 'pointer' }}>
          {estado?.subiendo ? 'Subiendo…' : 'Subir archivo'}
          <input type="file" style={{ display: 'none' }} disabled={disabled || estado?.subiendo} onChange={seleccionar} />
        </label>
      )}

      {estado?.error && (
        <p className="field-error" style={{ margin: 0 }}>
          {estado.error}
        </p>
      )}
    </div>
  )
}
