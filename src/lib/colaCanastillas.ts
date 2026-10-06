import { supabase } from './supabaseClient'
import { esErrorDeRed } from './colaRegistros'
import { conLimite } from './promesaConLimite'
import { subirFacturaCanastilla } from './facturasCanastillas'
import { ALMACEN_VENTAS_PENDIENTES, EVENTO_COLA_CAMBIO, conAlmacen } from './bdOffline'

// Más alto que el de un registro (12s): aquí además se sube la foto de la factura.
export const LIMITE_ENVIO_MS = 20000

/**
 * Cola de "Venta de canastillas" pendientes de sincronizar. Usa IndexedDB
 * (no localStorage, como la cola de registros de producción) porque cada
 * elemento incluye la foto de la factura como Blob: localStorage solo
 * guarda texto y tiene muy poco espacio (podría llenarse con una sola foto
 * y romper también la otra cola).
 */
export interface VentaPendiente {
  id: string
  userId: string
  finca: string
  fecha: string
  semana: number
  cantidad: number
  cantidadObsequio: number
  cantidadRepique: number
  notas: string | null
  foto: Blob | null
  fotoNombre: string | null
  fotoTipo: string | null
  creadoEn: string
  intentos: number
  ultimoError: string | null
}

export async function agregarVentaACola(venta: VentaPendiente): Promise<void> {
  await conAlmacen(ALMACEN_VENTAS_PENDIENTES, 'readwrite', (almacen) => almacen.put(venta))
  window.dispatchEvent(new Event(EVENTO_COLA_CAMBIO))
}

/** Si falla (navegador sin IndexedDB, modo privado, etc.) se trata como "sin pendientes". */
export async function leerColaVentas(): Promise<VentaPendiente[]> {
  try {
    return await conAlmacen<VentaPendiente[]>(ALMACEN_VENTAS_PENDIENTES, 'readonly', (almacen) => almacen.getAll())
  } catch {
    return []
  }
}

async function quitarDeCola(id: string) {
  await conAlmacen(ALMACEN_VENTAS_PENDIENTES, 'readwrite', (almacen) => almacen.delete(id))
}

async function marcarIntento(venta: VentaPendiente, error: string) {
  await conAlmacen(ALMACEN_VENTAS_PENDIENTES, 'readwrite', (almacen) =>
    almacen.put({ ...venta, intentos: venta.intentos + 1, ultimoError: error }),
  )
}

/** Sube la foto (si ya se tomó; puede quedar pendiente) y crea la venta.
 * Usa insert (no upsert): a diferencia de la cola de registros, aquí
 * cambiar las cantidades de una venta ya guardada queda reservado al
 * administrador — un operario solo puede completar la factura pendiente
 * después (ver VentaRow en VentaCanastillasPage.tsx), no editar cifras. La
 * foto sí se sube con upsert (ruta fija por venta) para que reintentar tras
 * un corte de conexión no falle si ya se había subido antes.
 */
export async function enviarVentaPendiente(venta: VentaPendiente): Promise<void> {
  let rutaFactura: string | null = null
  if (venta.foto) {
    const archivo = new File([venta.foto], venta.fotoNombre ?? 'factura.jpg', { type: venta.fotoTipo ?? 'image/jpeg' })
    rutaFactura = await subirFacturaCanastilla(venta.finca, archivo, venta.id)
  }

  const { error } = await supabase.from('ventas_canastillas').insert({
    id: venta.id,
    user_id: venta.userId,
    finca: venta.finca,
    fecha: venta.fecha,
    semana: venta.semana,
    cantidad: venta.cantidad,
    cantidad_obsequio: venta.cantidadObsequio,
    cantidad_repique: venta.cantidadRepique,
    factura_path: rutaFactura,
    notas: venta.notas,
  })
  if (error) throw error
}

/** Intenta sincronizar toda la cola; se detiene si detecta que ya no hay conexión. */
export async function sincronizarColaVentas(): Promise<{ sincronizados: number; pendientes: number }> {
  let sincronizados = 0
  for (const venta of await leerColaVentas()) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break
    try {
      await conLimite(enviarVentaPendiente(venta), LIMITE_ENVIO_MS)
      await quitarDeCola(venta.id)
      sincronizados++
    } catch (err) {
      if (esErrorDeRed(err)) break
      await marcarIntento(venta, err instanceof Error ? err.message : 'Error desconocido')
    }
  }
  return { sincronizados, pendientes: (await leerColaVentas()).length }
}
