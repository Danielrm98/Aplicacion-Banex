import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal } from './consultaConCache'
import type { Embolse } from '../types/embolse'

const TAMANO_PAGINA = 1000

/** PostgREST solo devuelve 1000 filas por consulta por defecto; con varias
 * fincas × lotes × 63 semanas ya se supera fácil, así que hay que pedir por
 * páginas y juntar todo en vez de una sola select(). */
async function traerTodosLosEmbolses(anioEmbolses: number): Promise<{ data: Embolse[] | null; error: { message: string } | null }> {
  const todos: Embolse[] = []
  let desde = 0
  while (true) {
    const { data, error } = await supabase
      .from('embolses')
      .select('*')
      .in('anio', [anioEmbolses - 1, anioEmbolses])
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) return { data: null, error }
    todos.push(...(data ?? []))
    if (!data || data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }
  return { data: todos, error: null }
}

/** Trae los embolses de los dos años calendario que componen un "año de
 * embolses" (ver anioEmbolses.ts); el filtro exacto por semana (42+ del año
 * anterior, 1-41 del año actual) se hace en quien consuma estos datos. RLS ya
 * limita lo que ve un operario a los lotes de su(s) finca(s). */
export function useEmbolses({ anioEmbolses }: { anioEmbolses: number }) {
  const [embolses, setEmbolses] = useState<Embolse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await conCacheLocal<Embolse[]>(
      `approban_cache_embolses_${anioEmbolses}`,
      () => traerTodosLosEmbolses(anioEmbolses),
      undefined,
      15000,
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setEmbolses(data ?? [])
    }
    setLoading(false)
  }, [anioEmbolses])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { embolses, loading, error, refetch }
}
