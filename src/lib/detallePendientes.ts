import { leerCola, descartarRegistroPendiente } from './colaRegistros'
import { leerColaVentas, descartarVentaPendiente } from './colaCanastillas'
import { leerColaEmbolses, descartarEmbolsePendiente } from './colaEmbolses'
import { leerColaRepiques, descartarRepiquePendiente } from './colaRepiques'

export interface ItemPendienteDetalle {
  tipo: 'registro' | 'venta' | 'embolse' | 'repique'
  id: string
  descripcion: string
  intentos: number
  ultimoError: string | null
}

/** Junta el contenido de las tres colas sin conexión en una sola lista, para mostrar qué hay pendiente y por qué. */
export async function listarPendientesDetalle(): Promise<ItemPendienteDetalle[]> {
  const registros = leerCola().map((r) => ({
    tipo: 'registro' as const,
    id: r.id,
    descripcion: `Registro de producción — finca ${r.header.finca} — ${r.header.fecha}`,
    intentos: r.intentos,
    ultimoError: r.ultimoError,
  }))
  const ventas = (await leerColaVentas()).map((v) => ({
    tipo: 'venta' as const,
    id: v.id,
    descripcion: `Venta de canastillas — finca ${v.finca} — ${v.fecha} (semana ${v.semana})`,
    intentos: v.intentos,
    ultimoError: v.ultimoError,
  }))
  const embolses = (await leerColaEmbolses()).map((e) => ({
    tipo: 'embolse' as const,
    id: e.clave,
    descripcion: `Embolse — lote ${e.payload.lote_id} — semana ${e.payload.semana} de ${e.payload.anio}`,
    intentos: e.intentos,
    ultimoError: e.ultimoError,
  }))
  const repiques = (await leerColaRepiques()).map((r) => ({
    tipo: 'repique' as const,
    id: r.clave,
    descripcion: `Repique — lote ${r.payload.lote_id} — semana ${r.payload.semana_embolse} de ${r.payload.anio_embolse} (edad ${r.payload.edad_semanas})`,
    intentos: r.intentos,
    ultimoError: r.ultimoError,
  }))
  return [...registros, ...ventas, ...embolses, ...repiques]
}

export async function descartarPendienteDetalle(item: ItemPendienteDetalle): Promise<void> {
  if (item.tipo === 'registro') descartarRegistroPendiente(item.id)
  else if (item.tipo === 'venta') await descartarVentaPendiente(item.id)
  else if (item.tipo === 'embolse') await descartarEmbolsePendiente(item.id)
  else await descartarRepiquePendiente(item.id)
}
