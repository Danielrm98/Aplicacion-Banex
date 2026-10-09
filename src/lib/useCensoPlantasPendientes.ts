import { useCallback, useEffect, useState } from 'react'
import { leerColaCensoPlantas, type CensoPlantasPendiente } from './colaCensoPlantas'

export function useCensoPlantasPendientes() {
  const [pendientes, setPendientes] = useState<CensoPlantasPendiente[]>([])
  const [cargado, setCargado] = useState(false)

  const recargar = useCallback(async () => {
    setPendientes(await leerColaCensoPlantas())
    setCargado(true)
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { pendientes, cargado, recargar }
}
