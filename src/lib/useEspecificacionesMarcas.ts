import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { EspecificacionMarca } from '../types/produccion'

export function useEspecificacionesMarcas() {
  const [especificaciones, setEspecificaciones] = useState<EspecificacionMarca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('especificaciones_marcas').select('*').order('marca')

    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setEspecificaciones(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { especificaciones, loading, error, refetch }
}
