import { supabase } from './supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function base64UrlABytes(base64Url: string): Uint8Array {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(base64)
  return Uint8Array.from(binario, (c) => c.charCodeAt(0))
}

export function notificacionesDisponibles(): boolean {
  return (
    !!VAPID_PUBLIC_KEY &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function estaSuscrito(): Promise<boolean> {
  if (!notificacionesDisponibles()) return false
  const registro = await navigator.serviceWorker.ready
  const suscripcion = await registro.pushManager.getSubscription()
  return suscripcion !== null
}

/** Pide permiso, crea la suscripción push del navegador y la guarda en Supabase. */
export async function activarNotificaciones(userId: string): Promise<void> {
  if (!notificacionesDisponibles()) {
    throw new Error('Este navegador no soporta notificaciones push.')
  }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    throw new Error('No se concedió el permiso de notificaciones.')
  }

  const registro = await navigator.serviceWorker.ready
  let suscripcion = await registro.pushManager.getSubscription()
  if (!suscripcion) {
    suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlABytes(VAPID_PUBLIC_KEY!) as BufferSource,
    })
  }

  const json = suscripcion.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: suscripcion.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/** Cancela la suscripción del navegador y la borra de Supabase. */
export async function desactivarNotificaciones(): Promise<void> {
  if (!notificacionesDisponibles()) return
  const registro = await navigator.serviceWorker.ready
  const suscripcion = await registro.pushManager.getSubscription()
  if (!suscripcion) return

  await supabase.from('push_subscriptions').delete().eq('endpoint', suscripcion.endpoint)
  await suscripcion.unsubscribe()
}
