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
      // Orden numérico ("2" antes que "10"), no alfabético: el nombre del
      // lote suele ser un número, y el orden alfabético de texto dejaba el
      // 10 y el 11 antes del 2.
      setLotes(
        [...(data ?? [])].sort((a, b) =>
          a.finca === b.finca
            ? a.nombre.localeCompare(b.nombre, undefined, { numeric: true })
            : a.finca.localeCompare(b.finca),
        ),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { lotes, loading, error, refetch }
}
