import { useCallback, useRef, useState } from 'react'

// Anchos arrastrables de TODAS las columnas de una tabla. Devuelve el ancho
// actual de cada una (para armar el grid-template-columns) y una función
// que arma el handler del "agarradero" de una columna puntual (el borde
// derecho, entre esa columna y la siguiente).
export function useColumnResize(anchosIniciales: number[], min = 60, max = 700) {
  const [anchos, setAnchos] = useState(anchosIniciales)
  const arrastre = useRef<{ index: number; x: number; ancho: number } | null>(null)

  const iniciarArrastre = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      arrastre.current = { index, x: e.clientX, ancho: anchos[index] }

      function onMove(ev: MouseEvent) {
        if (!arrastre.current) return
        const { index, x, ancho } = arrastre.current
        const delta = ev.clientX - x
        const nuevoAncho = Math.min(max, Math.max(min, ancho + delta))
        setAnchos(prev => prev.map((a, i) => (i === index ? nuevoAncho : a)))
      }
      function onUp() {
        arrastre.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [anchos, min, max],
  )

  const templateColumns = anchos.map(a => `${a}px`).join(' ')

  return { anchos, templateColumns, iniciarArrastre }
}
