import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useAuth } from './AuthContext'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import { leerSesionGuardada } from './sesionLocal'
import type { Perfil } from '../types/perfil'

interface PerfilYFincas {
  perfil: Perfil | null
  fincas: string[]
}

function claveCache(userId: string): string {
  return `approban_cache_perfil_${userId}`
}

// Casi toda la app espera a que el perfil cargue antes de mostrar algo, así
// que antes de que AuthContext resuelva la sesión (puede tardar sin señal
// con el token por vencer) ya se adelanta el id de usuario leyendo directo
// lo guardado en el dispositivo, para no dejar la pantalla en blanco
// mientras tanto si ya hay un perfil guardado de la última vez.
function idUsuarioProbable(sessionId: string | undefined): string | null {
  return sessionId ?? leerSesionGuardada()?.user.id ?? null
}

export function usePerfil() {
  const { session } = useAuth()
  const idProbable = idUsuarioProbable(session?.user.id)
  const [perfil, setPerfil] = useState<Perfil | null>(
    () => (idProbable ? leerCacheLocal<PerfilYFincas>(claveCache(idProbable)) : null)?.perfil ?? null,
  )
  const [fincas, setFincas] = useState<string[]>(
    () => (idProbable ? leerCacheLocal<PerfilYFincas>(claveCache(idProbable)) : null)?.fincas ?? [],
  )
  const [loading, setLoading] = useState(
    () => !(idProbable && leerCacheLocal<PerfilYFincas>(claveCache(idProbable))),
  )

  const refetch = useCallback(async () => {
    if (!session) {
      setPerfil(null)
      setFincas([])
      setLoading(false)
      return
    }
    const clave = claveCache(session.user.id)
    const cacheado = leerCacheLocal<PerfilYFincas>(clave)
    if (cacheado) {
      setPerfil(cacheado.perfil)
      setFincas(cacheado.fincas)
      setLoading(false)
    } else {
      setLoading(true)
    }

    const { data } = await conCacheLocal<PerfilYFincas>(clave, async () => {
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
    if (data) {
      setPerfil(data.perfil)
      setFincas(data.fincas)
    }
    setLoading(false)
  }, [session])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { perfil, fincas, loading, refetch }
}
