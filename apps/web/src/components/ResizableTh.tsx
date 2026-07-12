import type { ReactNode } from 'react'
import ColumnResizeHandle from './ColumnResizeHandle'

// Celda de header de tabla con su agarradero de ancho en el borde derecho.
export default function ResizableTh({ children, onMouseDown }: { children: ReactNode; onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <span style={{ position: 'relative' }}>
      {children}
      <ColumnResizeHandle onMouseDown={onMouseDown} />
    </span>
  )
}
