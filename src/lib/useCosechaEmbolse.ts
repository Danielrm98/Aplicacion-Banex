import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { leerCacheIdb, guardarCacheIdb } from './bdOffline'
import { semanaEmbolseDeEdad, lunesDeSemanaIso } from './cintaEmbolse'
import { anioDeSemana } from './isoWeek'
import { SEMANAS_RACIMO } from '../types/produccion'

const TAMANO_PAGINA = 1000
const LIMITE_CONSULTA_MS = 15000

export interface CosechaFinca {
  finca: string
  anio_embolse: number
  semana_embolse: number
  cantidad: number
}

interface FilaProduccion {
  finca: string
  fecha: string
  semana: number | null
  racimos_semana_7: number
  racimos_semana_8: number
  racimos_semana_9: number
  racimos_semana_10: number
  racimos_semana_11: number
  racimos_semana_12: number
}

/**
 * Los racimos cosechados en Registrar también descuentan del inventario de
 * embolse (igual que el repique), según la edad que tenían al cosecharlos.
 * A diferencia de embolses/repiques, producciones se guarda por finca (sin
 * lote), así que este descuento solo se puede calcular a nivel de finca,
 * no por lote — se usa la misma fórmula de edad→semana de embolse que ya
 * usa Repique.
 */
async function traerCosecha(anioEmbolses: number): Promise<CosechaFinca[]> {
  // Nada de lo cosechado antes del arranque del año de embolses (semana 42
  // del año anterior) puede afectar a este año de embolses, así que no hace
  // falta traer producciones de más atrás.
  const desdeFecha = lunesDeSemanaIso(anioEmbolses - 1, 42).toISOString().slice(0, 10)

  const filas: FilaProduccion[] = []
  let desde = 0
  while (true) {
    const { data, error } = await supabase
      .from('producciones')
      .select('finca, fecha, semana, racimos_semana_7, racimos_semana_8, racimos_semana_9, racimos_semana_10, racimos_semana_11, racimos_semana_12')
      .gte('fecha', desdeFecha)
      .order('fecha', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw new Error(error.message)
    filas.push(...((data ?? []) as FilaProduccion[]))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }

  const mapa = new Map<string, CosechaFinca>()
  for (const fila of filas) {
    if (!fila.semana) continue
    const anioReal = anioDeSemana(fila.fecha, fila.semana)
    for (const edad of SEMANAS_RACIMO) {
      const cantidad = fila[`racimos_semana_${edad}` as const]
      if (!cantidad) continue
      const { anio: anioEmbolse, semana: semanaEmbolse } = semanaEmbolseDeEdad(anioReal, fila.semana, edad)
      const clave = `${fila.finca}_${anioEmbolse}_${semanaEmbolse}`
      const existente = mapa.get(clave)
      if (existente) existente.cantidad += cantidad
      else mapa.set(clave, { finca: fila.finca, anio_embolse: anioEmbolse, semana_embolse: semanaEmbolse, cantidad })
    }
  }
  return [...mapa.values()]
}

/** Mismo patrón que useEmbolses/useRepiques: lo guardado en el celular se muestra de una vez; la red actualiza después. */
export function useCosechaEmbolse({ anioEmbolses }: { anioEmbolses: number }) {
  const clave = `approban_cache_cosecha_embolse_${anioEmbolses}`
  const [cosecha, setCosecha] = useState<CosechaFinca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLoading(false)
      return
    }
    try {
      const data = await conLimite(traerCosecha(anioEmbolses), LIMITE_CONSULTA_MS)
      setCosecha(data)
      setError(null)
      await guardarCacheIdb(clave, data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cosecha.')
    } finally {
      setLoading(false)
    }
  }, [anioEmbolses, clave])

  useEffect(() => {
    let cancelado = false
    leerCacheIdb<CosechaFinca[]>(clave).then((cache) => {
      if (cancelado) return
      setCosecha(cache ?? [])
      setLoading(cache === null)
      cargar()
    })
    return () => {
      cancelado = true
    }
  }, [clave, cargar])

  return { cosecha, loading, error, refetch: cargar }
}
