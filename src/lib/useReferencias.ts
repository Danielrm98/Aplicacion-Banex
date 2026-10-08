import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import referenciasBase from '../data/referenciasBase.json'
import type { Referencia } from '../types/produccion'

const CLAVE_CACHE = 'approban_cache_referencias'

export function useReferencias() {
  const [referencias, setReferencias] = useState<Referencia[]>(
    () => leerCacheLocal<Referencia[]>(CLAVE_CACHE) ?? (referenciasBase as Referencia[]),
  )
  const [loading, setLoading] = useState(() => leerCacheLocal<Referencia[]>(CLAVE_CACHE) === null)
  const [error, setError] = useState<string | null>(null)

  // No se pone "cargando" al refrescar: si ya hay referencias guardadas se
  // muestran de una vez y la actualización llega en segundo plano.
  const refetch = useCallback(async () => {
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
