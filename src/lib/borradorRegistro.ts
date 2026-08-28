import type { ProduccionHeaderInput } from '../types/produccion'

interface ItemBorrador {
  referencia: string
  cantidad_cajas: number
  cajas_rechazadas: number
}

interface TransporteBorrador {
  tipo: string
  hora_llegada: string
  hora_salida: string
  placa: string
  sello: string
}

export interface BorradorRegistro {
  header: ProduccionHeaderInput
  items: ItemBorrador[]
  transportes: TransporteBorrador[]
}

/**
 * Autoguardado local del formulario de Registrar. Existe porque en varios
 * navegadores (sobre todo móviles) cambiar de pestaña o de app puede hacer
 * que el navegador recargue la página al volver, perdiendo cualquier dato
 * que solo viviera en memoria de React.
 */
function clave(finca: string): string {
  return `approban_borrador_registro_${finca}`
}

export function leerBorrador(finca: string): BorradorRegistro | null {
  try {
    const bruto = localStorage.getItem(clave(finca))
    if (!bruto) return null
    return JSON.parse(bruto) as BorradorRegistro
  } catch {
    return null
  }
}

export function guardarBorrador(finca: string, borrador: BorradorRegistro) {
  try {
    localStorage.setItem(clave(finca), JSON.stringify(borrador))
  } catch {
    // localStorage lleno o no disponible (modo privado): el autoguardado
    // simplemente no aplica, sin romper el formulario.
  }
}

export function borrarBorrador(finca: string) {
  try {
    localStorage.removeItem(clave(finca))
  } catch {
    // ver comentario en guardarBorrador
  }
}

export function borradorTieneDatos(b: BorradorRegistro): boolean {
  return (
    b.items.some((it) => it.referencia || it.cantidad_cajas > 0) ||
    b.transportes.length > 0 ||
    Object.entries(b.header).some(([campo, valor]) => {
      if (campo === 'finca' || campo === 'fecha' || campo === 'semana') return false
      return valor !== null && valor !== '' && valor !== 0
    })
  )
}
