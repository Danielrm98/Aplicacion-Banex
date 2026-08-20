import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Referencia } from '../types/produccion'

export function useReferencias() {
  const [referencias, setReferencias] = useState<Referencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('referencias').select('*').order('marca')

    if (error) {
      setError(error.message)
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
