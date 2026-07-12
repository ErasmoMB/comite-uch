import { useEffect } from 'react'

export interface DocumentPreviewState {
  url: string
  mimeType: string
  fileName: string
}

interface Props {
  preview: DocumentPreviewState
  onClose: () => void
  onDescargar: () => void
}

// Modal de previsualización embebida (PDF/imagen en un iframe/img dentro de
// la propia app) — evita que "Ver" abra una pestaña nueva o dispare una
// descarga; solo el botón "Descargar" descarga el archivo.
export default function DocumentPreviewModal({ preview, onClose, onDescargar }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const previsualizable = preview.mimeType === 'application/pdf' || preview.mimeType.startsWith('image/')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: '90vw', maxWidth: 860, height: '85vh', maxHeight: 860, padding: 0, display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid var(--line-soft)',
            flex: 'none',
          }}
        >
          <strong style={{ fontSize: 14, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {preview.fileName}
          </strong>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 'none' }}>
            <button className="link" onClick={onDescargar}>
              Descargar
            </button>
            <button className="link" style={{ color: 'var(--slate-500)' }} onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, background: 'var(--bg)', display: 'flex' }}>
          {previsualizable ? (
            preview.mimeType.startsWith('image/') ? (
              <img
                src={preview.url}
                alt={preview.fileName}
                style={{ maxWidth: '100%', maxHeight: '100%', margin: 'auto', objectFit: 'contain' }}
              />
            ) : (
              <iframe src={preview.url} title={preview.fileName} style={{ flex: 1, border: 'none' }} />
            )
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', padding: 24, maxWidth: 320 }}>
              <p className="small muted" style={{ margin: '0 0 16px' }}>
                Este tipo de archivo (Word, Excel, etc.) no se puede previsualizar en el navegador. Puedes descargarlo para
                abrirlo.
              </p>
              <button className="btn btn-primary" onClick={onDescargar}>
                Descargar archivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
