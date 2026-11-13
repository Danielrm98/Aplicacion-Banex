import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conLimite } from './promesaConLimite'
import { EVENTO_COLA_CAMBIO } from './bdOffline'
import type { PerfilRacimoEvaluacion } from '../types/perfilRacimo'

export const LIMITE_MS = 8000

/** Evaluaciones de "Perfil de racimo" guardadas de una finca, de la más
 * reciente a la más antigua. A diferencia de Evaluación de banda, sí es un
 * historial permanente: no se purga nada al guardar una nueva. */
export function usePerfilesRacimo(finca: string | null) {
  const [evaluaciones, setEvaluaciones] = useState<PerfilRacimoEvaluacion[]>([])
  const [loading, setLoading] = useState(() => !!finca)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!finca) {
      setEvaluaciones([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await conLimite(
      supabase
        .from('perfil_racimo_evaluaciones')
        .select('*, muestras:perfil_racimo_muestras(*), defectos:perfil_racimo_defectos(*)')
        .eq('finca', finca)
        .order('created_at', { ascending: false })
        .limit(60),
      LIMITE_MS,
    )
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setEvaluaciones((data as PerfilRacimoEvaluacion[]) ?? [])
    }
    setLoading(false)
  }, [finca])

  useEffect(() => {
    refetch()
    // Cuando una evaluación guardada sin conexión termina de sincronizarse,
    // esta lista se refresca sola para mostrarla sin que el operario tenga
    // que recargar la página.
    window.addEventListener(EVENTO_COLA_CAMBIO, refetch)
    return () => window.removeEventListener(EVENTO_COLA_CAMBIO, refetch)
  }, [refetch])

  return { evaluaciones, loading, error, refetch }
}

export interface PerfilRacimoMuestraPayload {
  numeroMuestra: number
  hora: string | null
  lote: string | null
  noRacimo: string | null
  edadCinta: string | null
  gradoSudbasal: number | null
  gradoApical: number | null
  noManos: number | null
  largoApical: number | null
  pesoFrutaPremium: number | null
  pesoFrutaCorta: number | null
  pesoMerma: number | null
  vastagoCorona: number | null
}

export interface PerfilRacimoDefectoPayload {
  numeroMuestra: number
  grupo: string
  defecto: string
  cantidad: number
}

export interface PerfilRacimoPayload {
  id: string
  userId: string
  finca: string
  fecha: string
  semana: number
  muestras: PerfilRacimoMuestraPayload[]
  defectos: PerfilRacimoDefectoPayload[]
}

/** Guarda (crea o corrige) una evaluación completa: la cabecera y toda la
 * cuadrícula de las 10 muestras y sus defectos de una vez (se reemplazan
 * las muestras/defectos existentes, en vez de ir celda por celda, porque el
 * formulario se llena y se envía completo). El id siempre lo genera el
 * celular (upsert, no insert) para que reintentar sin conexión sea seguro y
 * para poder reutilizar esta misma función al sincronizar la cola. */
export async function guardarPerfilRacimo(payload: PerfilRacimoPayload): Promise<void> {
  const { error } = await conLimite(
    supabase.from('perfil_racimo_evaluaciones').upsert({
      id: payload.id,
      finca: payload.finca,
      fecha: payload.fecha,
      semana: payload.semana,
      user_id: payload.userId,
    }),
    LIMITE_MS,
  )
  if (error) throw error

  const { error: deleteMuestrasError } = await conLimite(
    supabase.from('perfil_racimo_muestras').delete().eq('evaluacion_id', payload.id),
    LIMITE_MS,
  )
  if (deleteMuestrasError) throw deleteMuestrasError

  const { error: deleteDefectosError } = await conLimite(
    supabase.from('perfil_racimo_defectos').delete().eq('evaluacion_id', payload.id),
    LIMITE_MS,
  )
  if (deleteDefectosError) throw deleteDefectosError

  // Solo se guardan las muestras que tengan algún dato (una fila en blanco
  // no es información real que valga la pena conservar).
  const muestrasConDatos = payload.muestras.filter(
    (m) =>
      m.hora ||
      m.lote ||
      m.noRacimo ||
      m.edadCinta ||
      m.gradoSudbasal !== null ||
      m.gradoApical !== null ||
      m.noManos !== null ||
      m.largoApical !== null ||
      m.pesoFrutaPremium !== null ||
      m.pesoFrutaCorta !== null ||
      m.pesoMerma !== null ||
      m.vastagoCorona !== null,
  )
  if (muestrasConDatos.length > 0) {
    const { error: insertMuestrasError } = await conLimite(
      supabase.from('perfil_racimo_muestras').insert(
        muestrasConDatos.map((m) => ({
          evaluacion_id: payload.id,
          numero_muestra: m.numeroMuestra,
          hora: m.hora,
          lote: m.lote,
          no_racimo: m.noRacimo,
          edad_cinta: m.edadCinta,
          grado_sudbasal: m.gradoSudbasal,
          grado_apical: m.gradoApical,
          no_manos: m.noManos,
          largo_apical: m.largoApical,
          peso_fruta_premium: m.pesoFrutaPremium,
          peso_fruta_corta: m.pesoFrutaCorta,
          peso_merma: m.pesoMerma,
          vastago_corona: m.vastagoCorona,
        })),
      ),
      LIMITE_MS,
    )
    if (insertMuestrasError) throw insertMuestrasError
  }

  const defectosConCantidad = payload.defectos.filter((d) => d.cantidad > 0)
  if (defectosConCantidad.length > 0) {
    const { error: insertDefectosError } = await conLimite(
      supabase.from('perfil_racimo_defectos').insert(
        defectosConCantidad.map((d) => ({
          evaluacion_id: payload.id,
          numero_muestra: d.numeroMuestra,
          grupo: d.grupo,
          defecto: d.defecto,
          cantidad: d.cantidad,
        })),
      ),
      LIMITE_MS,
    )
    if (insertDefectosError) throw insertDefectosError
  }
}

export async function eliminarPerfilRacimo(id: string): Promise<void> {
  const { error } = await conLimite(supabase.from('perfil_racimo_evaluaciones').delete().eq('id', id), LIMITE_MS)
  if (error) throw error
}
