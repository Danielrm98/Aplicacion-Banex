import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { leerCacheIdb, guardarCacheIdb } from './bdOffline'
import type { Embolse } from '../types/embolse'

const TAMANO_PAGINA = 1000
const LIMITE_CONSULTA_MS = 15000

/** PostgREST solo devuelve 1000 filas por consulta por defecto; con varias
 * fincas × lotes × 63 semanas ya se supera fácil, así que hay que pedir por
 * páginas y juntar todo en vez de una sola select(). */
async function traerTodosLosEmbolses(anioEmbolses: number): Promise<Embolse[]> {
  const todos: Embolse[] = []
  let desde = 0
  while (true) {
    const { data, error } = await supabase
      .from('embolses')
      .select('*')
      .in('anio', [anioEmbolses - 1, anioEmbolses])
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw new Error(error.message)
    todos.push(...(data ?? []))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }
  return todos
}

/** Trae los embolses de los dos años calendario que componen un "año de
 * embolses" (ver anioEmbolses.ts); el filtro exacto por semana (42+ del año
 * anterior, 1-41 del año actual) se hace en quien consuma estos datos. RLS ya
 * limita lo que ve un operario a los lotes de su(s) finca(s).
 *
 * Se muestra primero lo guardado en el celular (IndexedDB) y la red actualiza
 * después: sin señal el menú abre de inmediato con la última versión conocida. */
export function useEmbolses({ anioEmbolses }: { anioEmbolses: number }) {
  const clave = `approban_cache_embolses_${anioEmbolses}`
  const [embolses, setEmbolses] = useState<Embolse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // No se pone "cargando" al refrescar: si ya hay datos se quedan en pantalla.
  const cargar = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLoading(false)
      return
    }
    try {
      const data = await conLimite(traerTodosLosEmbolses(anioEmbolses), LIMITE_CONSULTA_MS)
      setEmbolses(data)
      setError(null)
      await guardarCacheIdb(clave, data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los embolses.')
    } finally {
      setLoading(false)
    }
  }, [anioEmbolses, clave])

  useEffect(() => {
    let cancelado = false
    leerCacheIdb<Embolse[]>(clave).then((cache) => {
      if (cancelado) return
      setEmbolses(cache ?? [])
      setLoading(cache === null)
      cargar()
    })
    return () => {
      cancelado = true
    }
  }, [clave, cargar])

  return { embolses, loading, error, refetch: cargar, refetchSilencioso: cargar }
}
