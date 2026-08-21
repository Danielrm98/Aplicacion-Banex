import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Finca } from '../types/finca'

export function useFincas() {
  const [fincas, setFincas] = useState<Finca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('fincas').select('*').order('nombre')

    if (error) {
      setError(error.message)
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
