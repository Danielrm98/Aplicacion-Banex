import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal } from './consultaConCache'
import referenciasBase from '../data/referenciasBase.json'
import type { Referencia } from '../types/produccion'

const CLAVE_CACHE = 'approban_cache_referencias'

export function useReferencias() {
  const [referencias, setReferencias] = useState<Referencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await conCacheLocal<Referencia[]>(
      CLAVE_CACHE,
      () => supabase.from('referencias').select('*').order('marca'),
      referenciasBase as Referencia[],
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setReferencias(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { referencias, loading, error, refetch }
}
