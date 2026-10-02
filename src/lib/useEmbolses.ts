import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal } from './consultaConCache'
import type { Embolse } from '../types/embolse'

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
    const { data, error } = await conCacheLocal<Embolse[]>(`approban_cache_embolses_${anioEmbolses}`, () =>
      supabase.from('embolses').select('*').in('anio', [anioEmbolses - 1, anioEmbolses]),
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
