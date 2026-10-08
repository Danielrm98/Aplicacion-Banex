import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { conCacheLocal, leerCacheLocal } from './consultaConCache'
import type { PerfilConFincas } from '../types/perfil'

const CLAVE_CACHE = 'approban_cache_perfiles'

export function usePerfiles() {
  const [perfiles, setPerfiles] = useState<PerfilConFincas[]>(() => leerCacheLocal<PerfilConFincas[]>(CLAVE_CACHE) ?? [])
  const [loading, setLoading] = useState(() => leerCacheLocal<PerfilConFincas[]>(CLAVE_CACHE) === null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await conCacheLocal<PerfilConFincas[]>(CLAVE_CACHE, async () => {
      const [perfilesRes, fincasRes] = await Promise.all([
        supabase.from('perfiles').select('*').order('usuario'),
        supabase.from('perfil_fincas').select('user_id, finca'),
      ])
      if (perfilesRes.error) return { data: null, error: perfilesRes.error }

      const fincasPorUsuario = new Map<string, string[]>()
      // Si perfil_fincas todavía no existe (falta correr la migración) esta
      // consulta falla; se sigue mostrando la lista igual, usando el
      // respaldo de perfiles.finca de cada fila más abajo.
      for (const r of fincasRes.data ?? []) {
        const arr = fincasPorUsuario.get(r.user_id) ?? []
        arr.push(r.finca)
        fincasPorUsuario.set(r.user_id, arr)
      }
      const conFincas = (perfilesRes.data ?? []).map((p) => {
        const asignadas = fincasPorUsuario.get(p.user_id) ?? []
        return { ...p, fincas: asignadas.length > 0 ? asignadas : p.finca ? [p.finca] : [] }
      })
      return { data: conFincas, error: null }
    })

    if (error) {
      setError(error)
    } else {
      setError(null)
      setPerfiles(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { perfiles, loading, error, refetch }
}
