export class ErrorTiempoAgotado extends Error {
  constructor() {
    super('Tiempo de espera agotado: sin respuesta del servidor.')
    this.name = 'ErrorTiempoAgotado'
  }
}

/**
 * Con señal celular débil (a diferencia de estar realmente sin conexión),
 * navigator.onLine sigue en true pero la petición nunca llega a buen puerto:
 * ni resuelve ni falla, se queda colgada para siempre. Esto envuelve la
 * promesa con un límite de tiempo para que, en ese caso, se trate igual que
 * un error de red (ver esErrorDeRed) y el registro/venta quede encolado en
 * vez de dejar al operario con el botón de guardar colgado.
 */
export function conLimite<T>(promesa: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new ErrorTiempoAgotado()), ms)
    Promise.resolve(promesa).then(
      (valor) => {
        clearTimeout(id)
        resolve(valor)
      },
      (err) => {
        clearTimeout(id)
        reject(err)
      },
    )
  })
}
