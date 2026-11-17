import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

// Lienzo de firma a mano, con eventos "pointer" (funciona igual con dedo,
// mouse o lápiz). El tamaño interno del canvas es fijo y más grande que el
// que se ve en pantalla (CSS lo encoge) para que la firma no salga
// pixelada al componerla en la imagen final de la factura.
const ANCHO_INTERNO = 500
const ALTO_INTERNO = 200

export interface FirmaCanvasRef {
  estaVacia: () => boolean
  limpiar: () => void
  obtenerCanvas: () => HTMLCanvasElement | null
}

const FirmaCanvas = forwardRef<FirmaCanvasRef, { etiqueta: string }>(function FirmaCanvas({ etiqueta }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const vacia = useRef(true)
  const [tieneTrazo, setTieneTrazo] = useState(false)

  useImperativeHandle(ref, () => ({
    estaVacia: () => vacia.current,
    limpiar,
    obtenerCanvas: () => canvasRef.current,
  }))

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * ANCHO_INTERNO,
      y: ((e.clientY - rect.top) / rect.height) * ALTO_INTERNO,
    }
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = posicion(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    dibujando.current = true
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = posicion(e)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    ctx.lineTo(x, y)
    ctx.stroke()
    if (vacia.current) {
      vacia.current = false
      setTieneTrazo(true)
    }
  }

  function terminar() {
    dibujando.current = false
  }

  function limpiar() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    vacia.current = true
    setTieneTrazo(false)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{etiqueta}</span>
        {tieneTrazo && (
          <button
            type="button"
            onClick={limpiar}
            className="text-xs font-medium text-banex-700 transition-colors hover:underline"
          >
            Limpiar firma
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={ANCHO_INTERNO}
        height={ALTO_INTERNO}
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        className="h-32 w-full touch-none rounded-lg border border-dashed border-gray-300 bg-white"
      />
      {!tieneTrazo && <p className="mt-1 text-xs text-gray-400">Firma aquí con el dedo o el mouse.</p>}
    </div>
  )
})

export default FirmaCanvas
