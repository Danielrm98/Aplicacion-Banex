const KEY = 'approban_finca_actual'

/**
 * Guarda/recupera la última finca elegida en Registrar, para que otras
 * pantallas (como Plan) puedan arrancar mostrando esa misma finca.
 */
export function guardarFincaActual(nombre: string) {
  try {
    localStorage.setItem(KEY, nombre)
  } catch {
    // localStorage no disponible; simplemente no se recuerda entre pantallas
  }
}

export function obtenerFincaActual(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
