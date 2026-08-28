import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Como useState, pero autoguarda el valor en localStorage y lo restaura al
 * montar. Existe porque en varios navegadores (sobre todo móviles) cambiar
 * de pestaña o de app puede hacer que el navegador recargue la página al
 * volver, perdiendo cualquier dato que solo viviera en memoria de React.
 *
 * No usar para datos sensibles (contraseñas): quedan en texto plano en el
 * localStorage del dispositivo.
 */
export function useDraftState<T>(clave: string, valorInicial: T | (() => T)): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = localStorage.getItem(clave)
      if (guardado !== null) return JSON.parse(guardado) as T
    } catch {
      // ignorar y usar el valor inicial
    }
    return valorInicial instanceof Function ? valorInicial() : valorInicial
  })

  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(valor))
    } catch {
      // localStorage lleno o no disponible (modo privado): el autoguardado
      // simplemente no aplica, sin romper el formulario.
    }
  }, [clave, valor])

  function limpiar() {
    try {
      localStorage.removeItem(clave)
    } catch {
      // ver comentario arriba
    }
    setValor(valorInicial instanceof Function ? valorInicial() : valorInicial)
  }

  return [valor, setValor, limpiar]
}
