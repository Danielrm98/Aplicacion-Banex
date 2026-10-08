import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import { anioDeSemana, getIsoWeek } from './isoWeek'

const TAMANO_PAGINA = 1000
// Más alto que el límite por defecto: esto pagina de a 1000 filas y puede
// necesitar varias idas y vueltas si hay mucho histórico acumulado.
const LIMITE_MS = 20000

function claveCache(desdeFecha: string): string {
  return `approban_cache_consolidado_${desdeFecha}`
}

export interface ProduccionConsolidable {
  fecha: string
  canastillas: number
}

export interface VentaConsolidable {
  fecha: string
  semana: number
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
  const sumar = (clave: string) => {
    if (!porClave.has(clave)) porClave.set(clave, { generadas: 0, vendidas: 0, obsequio: 0, repique: 0 })
    return porClave.get(clave)!
  }
  for (const p of producciones) sumar(claveSemanaIso(p.fecha)).generadas += p.canastillas
  for (const v of ventas) {
    // La venta se cuenta en la semana que le corresponde (la guardada), no en la de su fecha.
    const acc = sumar(`${anioDeSemana(v.fecha, v.semana)}-${v.semana}`)
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

interface DatosConsolidado {
  producciones: ProduccionConsolidable[]
  ventas: VentaConsolidable[]
}

const SIN_DATOS: DatosConsolidado = { producciones: [], ventas: [] }

export function useConsolidadoCanastillas(desdeFecha: string) {
  const [datos, setDatos] = useState<DatosConsolidado>(() => leerCacheLocal<DatosConsolidado>(claveCache(desdeFecha)) ?? SIN_DATOS)
  const [loading, setLoading] = useState(() => leerCacheLocal<DatosConsolidado>(claveCache(desdeFecha)) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await conCacheLocal<DatosConsolidado>(
      claveCache(desdeFecha),
      async () => {
        try {
          const [p, v] = await Promise.all([
            traerTodos<ProduccionConsolidable>('producciones', 'id, fecha, canastillas', desdeFecha),
            traerTodos<VentaConsolidable>(
              'ventas_canastillas',
              'id, fecha, semana, cantidad, cantidad_obsequio, cantidad_repique',
              desdeFecha,
            ),
          ])
          return { data: { producciones: p, ventas: v }, error: null }
        } catch (err) {
          return { data: null, error: { message: err instanceof Error ? err.message : 'No se pudo cargar el consolidado.' } }
        }
      },
      undefined,
      LIMITE_MS,
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setDatos(data ?? SIN_DATOS)
    }
    setLoading(false)
  }, [desdeFecha])

  useEffect(() => {
    const cacheado = leerCacheLocal<DatosConsolidado>(claveCache(desdeFecha))
    if (cacheado !== null) {
      setDatos(cacheado)
      setLoading(false)
    } else {
      setLoading(true)
    }
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  return { producciones: datos.producciones, ventas: datos.ventas, loading, error, refetch }
}
