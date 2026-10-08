import { useEffect, useState } from 'react'
import { listarPendientesDetalle, descartarPendienteDetalle, type ItemPendienteDetalle } from '../lib/detallePendientes'
import { EVENTO_COLA_CAMBIO } from '../lib/bdOffline'

/**
 * Muestra qué hay exactamente detrás del contador de "pendientes de
 * sincronizar" de este celular, y permite descartar a mano lo que ya se sabe
 * que quedó guardado de otra forma (por ejemplo, un intento repetido de
 * antes de que existiera el bloqueo de duplicados sin señal). Solo ve lo que
 * está guardado EN ESTE dispositivo — si el pendiente apareció en el celular
 * de un operario, hay que abrir esto desde ese mismo celular.
 */
export default function DetallePendientes() {
  const [abierto, setAbierto] = useState(false)
  const [items, setItems] = useState<ItemPendienteDetalle[]>([])
  const [cargando, setCargando] = useState(false)

  async function recargar() {
    setCargando(true)
    try {
      setItems(await listarPendientesDetalle())
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (!abierto) return
    recargar()
    window.addEventListener(EVENTO_COLA_CAMBIO, recargar)
    return () => window.removeEventListener(EVENTO_COLA_CAMBIO, recargar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  async function descartar(item: ItemPendienteDetalle) {
    const confirmado = window.confirm(
      `¿Seguro que quieres descartar este pendiente?\n\n${item.descripcion}\n\nSolo hazlo si ya confirmaste que esta información quedó guardada (por ejemplo, revisando el Historial). Esta acción no se puede deshacer.`,
    )
    if (!confirmado) return
    await descartarPendienteDetalle(item)
    recargar()
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="text-xs font-medium underline underline-offset-2 hover:text-amber-950"
      >
        {abierto ? 'Ocultar detalle' : 'Ver detalle'}
      </button>
      {abierto && (
        <div className="mx-auto mt-2 max-w-2xl rounded-lg border border-amber-200 bg-white p-3 text-left text-xs text-stone-700">
          {cargando ? (
            <p>Cargando...</p>
          ) : items.length === 0 ? (
            <p>Ya no hay nada pendiente en este celular.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={`${item.tipo}-${item.id}`} className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-stone-900">{item.descripcion}</p>
                    <p className="text-stone-500">
                      Intentos: {item.intentos}
                      {item.ultimoError ? ` — Último error: ${item.ultimoError}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => descartar(item)}
                    className="shrink-0 rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                  >
                    Descartar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
