import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { Lote } from '../types/lote'

const CLAVE_CACHE = 'approban_cache_lotes'

// Orden numérico ("2" antes que "10"), no alfabético: el nombre del
// lote suele ser un número, y el orden alfabético de texto dejaba el
// 10 y el 11 antes del 2.
function ordenarLotes(lotes: Lote[]): Lote[] {
  return [...lotes].sort((a, b) =>
    a.finca === b.finca
      ? a.nombre.localeCompare(b.nombre, undefined, { numeric: true })
      : a.finca.localeCompare(b.finca),
  )
}

export function useLotes() {
  const [lotes, setLotes] = useState<Lote[]>(() => ordenarLotes(leerCacheLocal<Lote[]>(CLAVE_CACHE) ?? []))
  const [loading, setLoading] = useState(() => leerCacheLocal<Lote[]>(CLAVE_CACHE) === null)
  const [error, setError] = useState<string | null>(null)

  // No se marca "cargando" al refrescar: si ya hay lotes guardados en el celular
  // se muestran de una vez y la actualización llega en segundo plano.
  const refetch = useCallback(async () => {
    const { data, error } = await conCacheLocal<Lote[]>(CLAVE_CACHE, () =>
      supabase.from('lotes').select('*').order('finca').order('nombre'),
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setLotes(ordenarLotes(data ?? []))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { lotes, loading, error, refetch }
}
