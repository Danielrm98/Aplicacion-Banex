import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal } from './consultaConCache'
import type { Lote } from '../types/lote'

export function useLotes() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await conCacheLocal<Lote[]>('approban_cache_lotes', () =>
      supabase.from('lotes').select('*').order('finca').order('nombre'),
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setLotes(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { lotes, loading, error, refetch }
}
