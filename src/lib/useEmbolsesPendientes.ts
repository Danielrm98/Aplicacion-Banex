import { useCallback, useEffect, useState } from 'react'
import { leerColaEmbolses, type EmbolsePendiente } from './colaEmbolses'

export function useEmbolsesPendientes() {
  const [pendientes, setPendientes] = useState<EmbolsePendiente[]>([])
  const [cargado, setCargado] = useState(false)

  const recargar = useCallback(async () => {
    setPendientes(await leerColaEmbolses())
    setCargado(true)
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { pendientes, cargado, recargar }
}
