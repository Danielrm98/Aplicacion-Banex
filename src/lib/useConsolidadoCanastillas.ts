import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { getIsoWeek } from './isoWeek'

const TAMANO_PAGINA = 1000

export interface ProduccionConsolidable {
  fecha: string
  canastillas: number
}

export interface VentaConsolidable {
  fecha: string
  cantidad: number
  cantidad_obsequio: number
  cantidad_repique: number
}

export interface SemanaConsolidada {
  clave: string
  anio: number
  semana: number
  generadas: number
  vendidas: number
  obsequio: number
  repique: number
  totalVendidas: number
  existencia: number
}

/** Año ISO y semana de una fecha, como "2026-40": la semana se cuenta igual que en el resto de la app. */
function claveSemanaIso(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00Z')
  const dia = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dia + 3)
  return `${d.getUTCFullYear()}-${getIsoWeek(fecha)}`
}

/** Pagina la consulta: PostgREST devuelve como máximo 1000 filas por petición. */
async function traerTodos<T>(tabla: string, columnas: string, desdeFecha: string): Promise<T[]> {
  const todos: T[] = []
  let desde = 0
  while (true) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .gte('fecha', desdeFecha)
      .order('fecha', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw new Error(error.message)
    todos.push(...((data ?? []) as unknown as T[]))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }
  return todos
}

export function consolidadoSemanal(
  producciones: ProduccionConsolidable[],
  ventas: VentaConsolidable[],
  desdeFecha: string,
  hastaFecha: string,
): SemanaConsolidada[] {
  const porClave = new Map<string, Omit<SemanaConsolidada, 'clave' | 'anio' | 'semana' | 'totalVendidas' | 'existencia'>>()
  const sumar = (fecha: string) => {
    const clave = claveSemanaIso(fecha)
    if (!porClave.has(clave)) porClave.set(clave, { generadas: 0, vendidas: 0, obsequio: 0, repique: 0 })
    return porClave.get(clave)!
  }
  for (const p of producciones) sumar(p.fecha).generadas += p.canastillas
  for (const v of ventas) {
    const acc = sumar(v.fecha)
    acc.vendidas += v.cantidad
    acc.obsequio += v.cantidad_obsequio ?? 0
    acc.repique += v.cantidad_repique ?? 0
  }

  // Todas las semanas desde el inicio del acumulado hasta la actual, aunque no tengan
  // movimientos: así se ve cada semana y no solo las que tuvieron registros.
  const claves: string[] = []
  const cursor = new Date(desdeFecha + 'T00:00:00Z')
  const hasta = new Date(hastaFecha + 'T00:00:00Z')
  while (cursor <= hasta) {
    const clave = claveSemanaIso(cursor.toISOString().slice(0, 10))
    if (!claves.includes(clave)) claves.push(clave)
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  let existencia = 0
  return claves.map((clave) => {
    const acc = porClave.get(clave) ?? { generadas: 0, vendidas: 0, obsequio: 0, repique: 0 }
    existencia += acc.generadas - acc.vendidas - acc.obsequio
    const [anio, semana] = clave.split('-').map(Number)
    return {
      clave,
      anio,
      semana,
      ...acc,
      totalVendidas: acc.vendidas + acc.repique,
      existencia,
    }
  })
}

export function useConsolidadoCanastillas(desdeFecha: string) {
  const [producciones, setProducciones] = useState<ProduccionConsolidable[]>([])
  const [ventas, setVentas] = useState<VentaConsolidable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, v] = await Promise.all([
        traerTodos<ProduccionConsolidable>('producciones', 'id, fecha, canastillas', desdeFecha),
        traerTodos<VentaConsolidable>(
          'ventas_canastillas',
          'id, fecha, cantidad, cantidad_obsequio, cantidad_repique',
          desdeFecha,
        ),
      ])
      setProducciones(p)
      setVentas(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el consolidado.')
    } finally {
      setLoading(false)
    }
  }, [desdeFecha])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { producciones, ventas, loading, error, refetch }
}
