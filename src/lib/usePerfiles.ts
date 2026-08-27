import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Perfil } from '../types/perfil'

export function usePerfiles() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('perfiles').select('*').order('usuario')

    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setPerfiles(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { perfiles, loading, error, refetch }
}
