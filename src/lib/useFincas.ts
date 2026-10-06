import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import fincasBase from '../data/fincasBase.json'
import type { Finca } from '../types/finca'

const CLAVE_CACHE = 'approban_cache_fincas'

export function useFincas() {
  const [fincas, setFincas] = useState<Finca[]>(() => leerCacheLocal<Finca[]>(CLAVE_CACHE) ?? (fincasBase as Finca[]))
  const [loading, setLoading] = useState(() => leerCacheLocal<Finca[]>(CLAVE_CACHE) === null)
  const [error, setError] = useState<string | null>(null)

  // Igual que en useLotes: refrescar no vuelve a poner la pantalla en "cargando".
  const refetch = useCallback(async () => {
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
