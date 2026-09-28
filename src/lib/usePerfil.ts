import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { conCacheLocal } from './consultaConCache'
import type { Perfil } from '../types/perfil'

interface PerfilYFincas {
  perfil: Perfil | null
  fincas: string[]
}

export function usePerfil() {
  const { session } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [fincas, setFincas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!session) {
      setPerfil(null)
      setFincas([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await conCacheLocal<PerfilYFincas>(`approban_cache_perfil_${session.user.id}`, async () => {
      const [perfilRes, fincasRes] = await Promise.all([
        supabase.from('perfiles').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('perfil_fincas').select('finca').eq('user_id', session.user.id),
      ])
      if (perfilRes.error) return { data: null, error: perfilRes.error }
      if (fincasRes.error) return { data: null, error: fincasRes.error }
      const perfilData = perfilRes.data ?? null
      const fincasAsignadas = (fincasRes.data ?? []).map((r) => r.finca)
      // Respaldo mientras no se haya corrido la migración de perfil_fincas (o
      // para un usuario que aún no se migró): sigue funcionando con la única
      // finca antigua en vez de dejarlo sin ninguna.
      const fincasFinal = fincasAsignadas.length > 0 ? fincasAsignadas : perfilData?.finca ? [perfilData.finca] : []
      return { data: { perfil: perfilData, fincas: fincasFinal }, error: null }
    })
    setPerfil(data?.perfil ?? null)
    setFincas(data?.fincas ?? [])
    setLoading(false)
  }, [session])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { perfil, fincas, loading, refetch }
}
