import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { PlanSemana } from '../types/plan'

interface Criterio {
  finca: string
  semana: number
  anio: number
}

function claveCache({ finca, semana, anio }: Criterio): string {
  return `approban_cache_plan_${finca}_${anio}_${semana}`
}

export function usePlan(criterio: Criterio) {
  const { finca } = criterio
  const [plan, setPlan] = useState<PlanSemana | null>(() => leerCacheLocal<PlanSemana>(claveCache(criterio)))
  const [loading, setLoading] = useState(() => !!finca && leerCacheLocal<PlanSemana>(claveCache(criterio)) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setPlan(null)
      setLoading(false)
      return
    }

    const { data, error } = await conCacheLocal<PlanSemana>(claveCache(criterio), () =>
      supabase
        .from('planes_semana')
        .select('*, items:plan_items(*)')
        .eq('finca', criterio.finca)
        .eq('semana', criterio.semana)
        .eq('anio', criterio.anio)
        .maybeSingle(),
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setPlan(data ?? null)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finca, criterio.semana, criterio.anio])

  useEffect(() => {
    const cacheado = leerCacheLocal<PlanSemana>(claveCache(criterio))
    if (cacheado !== null) {
      setPlan(cacheado)
      setLoading(false)
    } else {
      setLoading(!!finca)
    }
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch])

  return { plan, loading, error, refetch }
}
