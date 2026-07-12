// Línea vertical arrastrable en el borde derecho de una columna de tabla,
// para agrandarla/achicarla (ver useColumnResize). Se coloca dentro de un
// header cell con position:relative.
export default function ColumnResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      onClick={e => e.stopPropagation()}
      title="Arrastra para cambiar el ancho de la columna"
      className="col-resize-handle"
    />
  )
}
