import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import { conLimite } from './promesaConLimite'
import type { LluviaReportada } from '../types/lluvia'

const LIMITE_MS = 6000

function claveCache(finca: string): string {
  return `approban_cache_lluvia_${finca}`
}

/** Todo el historial reportado de una finca (sin límite de filas, para el
 * menú Registro de lluvia — a diferencia del panel de clima en Registrar,
 * que solo necesitaba los últimos reportes). */
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
      supabase.from('lluvia_reportada').select('*').eq('finca', finca).order('fecha', { ascending: false }),
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

/** Historial completo de todas las fincas (solo admin, por RLS) — para el
 * botón de exportar todo a Excel desde "Todas las fincas". */
export async function obtenerTodaLaLluviaReportada(): Promise<LluviaReportada[]> {
  const { data, error } = await conLimite(
    supabase.from('lluvia_reportada').select('*').order('finca', { ascending: true }).order('fecha', { ascending: true }),
    LIMITE_MS,
  )
  if (error) throw error
  return data ?? []
}
