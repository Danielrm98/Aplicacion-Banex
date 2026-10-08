import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { EspecificacionMarca } from '../types/produccion'

const CLAVE_CACHE = 'approban_cache_especificaciones_marcas'

export function useEspecificacionesMarcas() {
  const [especificaciones, setEspecificaciones] = useState<EspecificacionMarca[]>(
    () => leerCacheLocal<EspecificacionMarca[]>(CLAVE_CACHE) ?? [],
  )
  const [loading, setLoading] = useState(() => leerCacheLocal<EspecificacionMarca[]>(CLAVE_CACHE) === null)
  const [error, setError] = useState<string | null>(null)

  // Mismo patrón que useReferencias/useLotes/useFincas: se muestra lo guardado
  // de inmediato (sin "cargando") y la red actualiza en segundo plano.
  const refetch = useCallback(async () => {
    const { data, error } = await conCacheLocal<EspecificacionMarca[]>(CLAVE_CACHE, () =>
      supabase.from('especificaciones_marcas').select('*').order('marca'),
    )

    if (error) {
      setError(error)
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
