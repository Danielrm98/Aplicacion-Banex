import { useState } from 'react'
import { NIVELES_TAMANO_TEXTO, guardarTamanoTexto, obtenerTamanoTexto } from '../lib/tamanoTexto'

export default function TextSizeControl() {
  const [nivel, setNivel] = useState(obtenerTamanoTexto)
  const indice = NIVELES_TAMANO_TEXTO.indexOf(nivel)

  function cambiar(nuevoIndice: number) {
    const nuevoNivel = NIVELES_TAMANO_TEXTO[nuevoIndice]
    setNivel(nuevoNivel)
    guardarTamanoTexto(nuevoNivel)
  }

  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/10 p-1"
      role="group"
      aria-label="Tamaño de letra"
    >
      <button
        type="button"
        onClick={() => cambiar(indice - 1)}
        disabled={indice === 0}
        title="Disminuir tamaño de letra"
        aria-label="Disminuir tamaño de letra"
        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-banex-50 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent sm:h-7 sm:w-7 sm:text-sm"
      >
        A−
      </button>
      <button
        type="button"
        onClick={() => cambiar(indice + 1)}
        disabled={indice === NIVELES_TAMANO_TEXTO.length - 1}
        title="Aumentar tamaño de letra"
        aria-label="Aumentar tamaño de letra"
        className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-banex-50 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent sm:h-7 sm:w-7 sm:text-base"
      >
        A+
      </button>
    </div>
  )
}
