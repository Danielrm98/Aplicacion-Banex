// Función de servidor (Edge Function) que envía una notificación push al
// administrador cada vez que se crea un registro de producción o una venta
// de canastillas. La llama un "Database Webhook" de Supabase (configurado
// en el Dashboard, ver README junto a esta carpeta) apenas se inserta una
// fila en "producciones" o "ventas_canastillas".
//
// Se despliega una sola vez con:
//   npx supabase functions deploy notificar-push --project-ref <tu-project-ref> --no-verify-jwt
//
// Necesita estos secretos configurados en el proyecto (Dashboard -> Edge
// Functions -> notificar-push -> Secrets, o `supabase secrets set`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ej. mailto:tu@correo.com)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los inyecta Supabase solo.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@approban.local'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface Registro {
  finca?: string
  fecha?: string
  cantidad?: number
  cantidad_obsequio?: number
  cantidad_repique?: number
}

function mensajeDe(table: string, record: Registro): { titulo: string; cuerpo: string } {
  if (table === 'producciones') {
    return {
      titulo: 'Nuevo registro de producción',
      cuerpo: `${record.finca ?? 'Finca'} · ${record.fecha ?? ''}`,
    }
  }
  if (table === 'ventas_canastillas') {
    const partes: string[] = []
    if ((record.cantidad ?? 0) > 0) partes.push(`${record.cantidad} vendidas`)
    if ((record.cantidad_obsequio ?? 0) > 0) partes.push(`${record.cantidad_obsequio} obsequio`)
    if ((record.cantidad_repique ?? 0) > 0) partes.push(`${record.cantidad_repique} repique`)
    return {
      titulo: 'Nueva venta de canastillas',
      cuerpo: `${record.finca ?? 'Finca'} · ${partes.join(', ') || 'sin cantidad'}`,
    }
  }
  return { titulo: 'ApproBan', cuerpo: 'Hay actividad nueva.' }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const table = payload.table as string
    const record = payload.record as Registro
    const { titulo, cuerpo } = mensajeDe(table, record)

    const { data: subs, error } = await supabase.from('push_subscriptions').select('*')
    if (error) throw error

    await Promise.all(
      (subs ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: titulo, body: cuerpo, url: '/' }),
          )
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode
          if (status === 404 || status === 410) {
            // Suscripción vencida o inválida (el navegador la revocó): se
            // borra para no seguir intentando en vano.
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            console.error('Error enviando push a', sub.id, err)
          }
        }
      }),
    )

    return new Response(JSON.stringify({ ok: true, enviados: subs?.length ?? 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
