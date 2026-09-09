const KEY = 'approban_tamano_texto'

// Como Tailwind usa unidades rem, cambiar el font-size del <html> escala de
// forma proporcional el texto y buena parte del espaciado de toda la app.
export const NIVELES_TAMANO_TEXTO = [100, 112, 125, 140] as const
export type NivelTamanoTexto = (typeof NIVELES_TAMANO_TEXTO)[number]

const NIVEL_POR_DEFECTO: NivelTamanoTexto = 100

function esNivelValido(valor: number): valor is NivelTamanoTexto {
  return (NIVELES_TAMANO_TEXTO as readonly number[]).includes(valor)
}

export function obtenerTamanoTexto(): NivelTamanoTexto {
  try {
    const guardado = Number(localStorage.getItem(KEY))
    return esNivelValido(guardado) ? guardado : NIVEL_POR_DEFECTO
  } catch {
    return NIVEL_POR_DEFECTO
  }
}

function aplicarTamanoTexto(nivel: NivelTamanoTexto) {
  document.documentElement.style.fontSize = `${nivel}%`
}

/** Se llama una sola vez al arrancar la app, antes de renderizar. */
export function inicializarTamanoTexto() {
  aplicarTamanoTexto(obtenerTamanoTexto())
}

export function guardarTamanoTexto(nivel: NivelTamanoTexto) {
  aplicarTamanoTexto(nivel)
  try {
    localStorage.setItem(KEY, String(nivel))
  } catch {
    // localStorage no disponible; el ajuste no persiste entre sesiones
  }
}
