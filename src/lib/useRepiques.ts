import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { leerCacheIdb, guardarCacheIdb } from './bdOffline'
import type { Repique } from '../types/repique'

const TAMANO_PAGINA = 1000
const LIMITE_CONSULTA_MS = 15000

/** PostgREST solo devuelve 1000 filas por consulta por defecto. */
async function traerTodosLosRepiques(anioEmbolses: number): Promise<Repique[]> {
  const todos: Repique[] = []
  let desde = 0
  while (true) {
    const { data, error } = await supabase
      .from('repiques')
      .select('*')
      .in('anio_embolse', [anioEmbolses - 1, anioEmbolses])
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw new Error(error.message)
    todos.push(...(data ?? []))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }
  return todos
}

/** Mismo patrón que useEmbolses: se muestra primero lo guardado en el
 * celular (IndexedDB) y la red actualiza después, para que sin señal el
 * menú abra de inmediato con la última versión conocida. */
export function useRepiques({ anioEmbolses }: { anioEmbolses: number }) {
  const clave = `approban_cache_repiques_${anioEmbolses}`
  const [repiques, setRepiques] = useState<Repique[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLoading(false)
      return
    }
    try {
      const data = await conLimite(traerTodosLosRepiques(anioEmbolses), LIMITE_CONSULTA_MS)
      setRepiques(data)
      setError(null)
      await guardarCacheIdb(clave, data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los repiques.')
    } finally {
      setLoading(false)
    }
  }, [anioEmbolses, clave])

  useEffect(() => {
    let cancelado = false
    leerCacheIdb<Repique[]>(clave).then((cache) => {
      if (cancelado) return
      setRepiques(cache ?? [])
      setLoading(cache === null)
      cargar()
    })
    return () => {
      cancelado = true
    }
  }, [clave, cargar])

  return { repiques, loading, error, refetch: cargar, refetchSilencioso: cargar }
}
