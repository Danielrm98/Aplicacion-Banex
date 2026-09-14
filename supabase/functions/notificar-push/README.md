# Notificaciones push al administrador

Envía una notificación push (como una notificación normal del celular) cada
vez que se crea un registro de producción o una venta de canastillas.

## 1. Desplegar la función

```
npx supabase functions deploy notificar-push --project-ref <tu-project-ref> --no-verify-jwt
```

`--no-verify-jwt` es necesario porque a esta función solo la llama la propia
base de datos (un Database Webhook), no un usuario desde el navegador.

## 2. Configurar los secretos de la función

El par de claves VAPID (una vez generado, no se vuelve a generar) lo dio
Claude directamente en la conversación, no queda escrito aquí — la clave
**privada** nunca debe ir en el código ni en el repositorio, solo como
secreto de la función:

```
npx supabase secrets set --project-ref <tu-project-ref> \
  VAPID_PUBLIC_KEY=<la clave pública> \
  VAPID_PRIVATE_KEY=<la clave privada> \
  VAPID_SUBJECT=mailto:tu-correo@ejemplo.com
```

(También se puede hacer desde el Dashboard: Edge Functions → notificar-push
→ Secrets.)

La clave **pública** es la misma que debe quedar en la variable de entorno
`VITE_VAPID_PUBLIC_KEY` del proyecto en Vercel (Settings → Environment
Variables) y en `.env.local` para desarrollo local — esa sí es pública, se
usa desde el navegador.

## 3. Crear los "Database Webhooks" que avisan a esta función

En el Dashboard de Supabase: **Database → Webhooks → Create a new hook**.
Crear dos, uno por tabla:

**Webhook 1:**
- Name: `notificar-push-producciones`
- Table: `producciones`
- Events: `Insert`
- Type: `Supabase Edge Functions`
- Edge Function: `notificar-push`

**Webhook 2:**
- Name: `notificar-push-ventas-canastillas`
- Table: `ventas_canastillas`
- Events: `Insert`
- Type: `Supabase Edge Functions`
- Edge Function: `notificar-push`

Con eso, cada vez que se inserte una fila nueva en cualquiera de esas dos
tablas, Supabase llama automáticamente a esta función.
