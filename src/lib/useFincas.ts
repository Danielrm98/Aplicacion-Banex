import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal } from './consultaConCache'
import fincasBase from '../data/fincasBase.json'
import type { Finca } from '../types/finca'

const CLAVE_CACHE = 'approban_cache_fincas'

export function useFincas() {
  const [fincas, setFincas] = useState<Finca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await conCacheLocal<Finca[]>(
      CLAVE_CACHE,
      () => supabase.from('fincas').select('*').order('nombre'),
      fincasBase as Finca[],
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setFincas(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { fincas, loading, error, refetch }
}
