import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { Produccion } from '../types/produccion'

export interface Filtros {
  semana?: number
  fecha?: string
  finca?: string
}

const CLAVE_CACHE_BASE = 'approban_cache_producciones'

// Se guarda una copia por cada combinación de filtros usada, así que el
// Historial puede mostrar sin señal lo último que se vio con esos mismos
// filtros (por ejemplo, la vista sin filtrar que es la que se abre siempre
// de primeras).
function claveCache(filtros: Filtros): string {
  return `${CLAVE_CACHE_BASE}_${JSON.stringify(filtros)}`
}

export function useProducciones(filtros: Filtros) {
  const [registros, setRegistros] = useState<Produccion[]>(() => leerCacheLocal<Produccion[]>(claveCache(filtros)) ?? [])
  const [loading, setLoading] = useState(() => leerCacheLocal<Produccion[]>(claveCache(filtros)) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await conCacheLocal<Produccion[]>(claveCache(filtros), () => {
      let query = supabase
        .from('producciones')
        .select('*, items:produccion_items(*), transportes(*)')
        .order('fecha', { ascending: false })

      if (filtros.semana) query = query.eq('semana', filtros.semana)
      if (filtros.fecha) query = query.eq('fecha', filtros.fecha)
      if (filtros.finca) query = query.eq('finca', filtros.finca)

      return query
    })

    if (error) {
      setError(error)
    } else {
      setError(null)
      setRegistros(data ?? [])
    }
    setLoading(false)
  }, [filtros])

  useEffect(() => {
    // Al cambiar de filtros se muestra de una vez lo guardado para esa
    // combinación (si hay) mientras llega la versión actualizada, en vez de
    // quedar en blanco un momento.
    const cacheado = leerCacheLocal<Produccion[]>(claveCache(filtros))
    if (cacheado !== null) {
      setRegistros(cacheado)
      setLoading(false)
    } else {
      setLoading(true)
    }
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  return { registros, loading, error, refetch }
}
