import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import { conLimite } from './promesaConLimite'

const LIMITE_MS = 6000
import type { LluviaHistorialDia } from './useClima'
import type { LluviaReportada } from '../types/lluvia'

function claveCache(finca: string): string {
  return `approban_cache_lluvia_${finca}`
}

export interface LluviaHistorialConFuente extends LluviaHistorialDia {
  fuente: 'reportado' | 'estimado'
}

/** El dato reportado manualmente en finca reemplaza al estimado del pronóstico. */
export function combinarHistorialLluvia(
  historialApi: LluviaHistorialDia[],
  reportes: LluviaReportada[],
): LluviaHistorialConFuente[] {
  const reportesPorFecha = new Map(reportes.map((r) => [r.fecha, r.milimetros]))
  return historialApi.map((dia) => {
    const reportado = reportesPorFecha.get(dia.fecha)
    return reportado !== undefined
      ? { fecha: dia.fecha, mm: reportado, fuente: 'reportado' as const }
      : { ...dia, fuente: 'estimado' as const }
  })
}

export function useLluviaReportada(finca: string | null) {
  const [reportes, setReportes] = useState<LluviaReportada[]>(
    () => (finca ? leerCacheLocal<LluviaReportada[]>(claveCache(finca)) : null) ?? [],
  )
  const [loading, setLoading] = useState(() => !!finca && leerCacheLocal<LluviaReportada[]>(claveCache(finca)) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setReportes([])
      setLoading(false)
      return
    }
    const { data, error } = await conCacheLocal<LluviaReportada[]>(claveCache(finca), () =>
      supabase.from('lluvia_reportada').select('*').eq('finca', finca).order('fecha', { ascending: false }).limit(30),
    )

    if (error) {
      setError(error)
    } else {
      setError(null)
      setReportes(data ?? [])
    }
    setLoading(false)
  }, [finca])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { reportes, loading, error, refetch }
}

export async function guardarLluviaReportada(finca: string, fecha: string, milimetros: number) {
  const {
    data: { user },
  } = await conLimite(supabase.auth.getUser(), LIMITE_MS)
  if (!user) throw new Error('No hay sesión activa.')

  const { error } = await conLimite(
    supabase.from('lluvia_reportada').upsert(
      {
        finca,
        fecha,
        milimetros,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'finca,fecha' },
    ),
    LIMITE_MS,
  )
  if (error) throw error
}

export async function eliminarLluviaReportada(id: string) {
  const { error } = await conLimite(supabase.from('lluvia_reportada').delete().eq('id', id), LIMITE_MS)
  if (error) throw error
}
