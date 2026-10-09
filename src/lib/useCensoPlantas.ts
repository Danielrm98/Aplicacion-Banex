import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { leerCacheIdb, guardarCacheIdb } from './bdOffline'
import type { CensoPlantas } from '../types/censoPlantas'

const TAMANO_PAGINA = 1000
const LIMITE_CONSULTA_MS = 15000

async function traerTodoElCenso(anio: number): Promise<CensoPlantas[]> {
  const todos: CensoPlantas[] = []
  let desde = 0
  while (true) {
    const { data, error } = await supabase
      .from('censo_plantas')
      .select('*')
      .in('anio', [anio - 1, anio])
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw new Error(error.message)
    todos.push(...(data ?? []))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }
  return todos
}

/** Mismo patrón que useRepiques/useEmbolses: lo guardado en el celular se
 * muestra de una vez; la red actualiza después. */
export function useCensoPlantas({ anio }: { anio: number }) {
  const clave = `approban_cache_censo_plantas_${anio}`
  const [censo, setCenso] = useState<CensoPlantas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLoading(false)
      return
    }
    try {
      const data = await conLimite(traerTodoElCenso(anio), LIMITE_CONSULTA_MS)
      setCenso(data)
      setError(null)
      await guardarCacheIdb(clave, data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el censo de plantas.')
    } finally {
      setLoading(false)
    }
  }, [anio, clave])

  useEffect(() => {
    let cancelado = false
    leerCacheIdb<CensoPlantas[]>(clave).then((cache) => {
      if (cancelado) return
      setCenso(cache ?? [])
      setLoading(cache === null)
      cargar()
    })
    return () => {
      cancelado = true
    }
  }, [clave, cargar])

  return { censo, loading, error, refetch: cargar, refetchSilencioso: cargar }
}
