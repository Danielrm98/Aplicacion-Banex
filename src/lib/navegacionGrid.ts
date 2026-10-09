import type { KeyboardEvent } from 'react'

/**
 * Navegación tipo hoja de cálculo entre los <input> de una cuadrícula (cada
 * uno marcado con data-fila/data-col): flecha arriba/abajo siempre cambia de
 * celda (si no, el navegador usa esas flechas para subir/bajar el número);
 * izquierda/derecha solo cambia de celda cuando el cursor ya está en el
 * borde del texto, para no estorbar al mover el cursor dentro de un valor
 * de varios dígitos.
 */
export function manejarFlechasCelda(e: KeyboardEvent<HTMLInputElement>, fila: number, columna: number) {
  const input = e.currentTarget
  let deltaFila = 0
  let deltaColumna = 0

  if (e.key === 'ArrowUp') deltaFila = -1
  else if (e.key === 'ArrowDown') deltaFila = 1
  else if (e.key === 'ArrowLeft' && input.selectionStart === 0 && input.selectionEnd === 0) deltaColumna = -1
  else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
    deltaColumna = 1
  } else return

  const destino = input
    .closest('table')
    ?.querySelector<HTMLInputElement>(`[data-fila="${fila + deltaFila}"][data-col="${columna + deltaColumna}"]`)
  if (!destino) return

  e.preventDefault()
  destino.focus()
  destino.select()
}
