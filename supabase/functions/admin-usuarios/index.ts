// Función de servidor (Edge Function) para que un admin pueda crear,
// resetear la contraseña y eliminar usuarios internos sin exponer la
// llave de servicio de Supabase en el navegador.
//
// Se despliega una sola vez con:
//   npx supabase functions deploy admin-usuarios --project-ref <tu-project-ref>
//
// Usa las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY,
// que Supabase inyecta automáticamente en toda función desplegada.

import { createClient } from 'npm:@supabase/supabase-js@2'

const DOMINIO_USUARIO = 'approban.local'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function respuesta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizarUsuario(usuario: unknown): string | null {
  if (typeof usuario !== 'string') return null
  const limpio = usuario.trim().toLowerCase()
  if (!/^[a-z0-9._]{3,20}$/.test(limpio)) return null
  return limpio
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Verificar que quien llama está autenticado y es admin.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) {
    return respuesta({ error: 'No autenticado.' }, 401)
  }

  const { data: perfilCaller } = await admin
    .from('perfiles')
    .select('rol')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (perfilCaller?.rol !== 'admin') {
    return respuesta({ error: 'Solo un administrador puede gestionar usuarios.' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return respuesta({ error: 'Cuerpo de la petición inválido.' }, 400)
  }

  const accion = body.accion

  if (accion === 'crear') {
    const usuario = normalizarUsuario(body.usuario)
    if (!usuario) {
      return respuesta(
        { error: 'El usuario debe tener entre 3 y 20 caracteres: letras, números, puntos o guion bajo.' },
        400,
      )
    }
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 6) {
      return respuesta({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
    }
    const rol = body.rol === 'admin' ? 'admin' : 'operador'
    const finca = rol === 'admin' ? null : typeof body.finca === 'string' && body.finca ? body.finca : null
    if (rol === 'operador' && !finca) {
      return respuesta({ error: 'Selecciona la finca del nuevo usuario.' }, 400)
    }
    const nombre = typeof body.nombre === 'string' && body.nombre.trim() ? body.nombre.trim() : null

    const email = `${usuario}@${DOMINIO_USUARIO}`
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created.user) {
      const mensaje = createError?.message.includes('already registered')
        ? `El usuario "${usuario}" ya existe.`
        : createError?.message ?? 'No se pudo crear el usuario.'
      return respuesta({ error: mensaje }, 400)
    }

    const { error: perfilError } = await admin
      .from('perfiles')
      .insert({ user_id: created.user.id, usuario, nombre, rol, finca })

    if (perfilError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return respuesta({ error: `No se pudo guardar el perfil: ${perfilError.message}` }, 400)
    }

    return respuesta({ usuario, nombre, rol, finca })
  }

  if (accion === 'resetear_password') {
    const usuario = normalizarUsuario(body.usuario)
    const password = typeof body.password === 'string' ? body.password : ''
    if (!usuario || password.length < 6) {
      return respuesta({ error: 'Usuario inválido o contraseña muy corta (mínimo 6 caracteres).' }, 400)
    }
    const { data: perfil } = await admin.from('perfiles').select('user_id').eq('usuario', usuario).maybeSingle()
    if (!perfil) return respuesta({ error: `No existe el usuario "${usuario}".` }, 404)

    const { error } = await admin.auth.admin.updateUserById(perfil.user_id, { password })
    if (error) return respuesta({ error: error.message }, 400)
    return respuesta({ ok: true })
  }

  if (accion === 'eliminar') {
    const usuario = normalizarUsuario(body.usuario)
    if (!usuario) return respuesta({ error: 'Usuario inválido.' }, 400)
    const { data: perfil } = await admin.from('perfiles').select('user_id').eq('usuario', usuario).maybeSingle()
    if (!perfil) return respuesta({ error: `No existe el usuario "${usuario}".` }, 404)
    if (perfil.user_id === userData.user.id) {
      return respuesta({ error: 'No puedes eliminar tu propio usuario.' }, 400)
    }

    const { error } = await admin.auth.admin.deleteUser(perfil.user_id)
    if (error) return respuesta({ error: error.message }, 400)
    return respuesta({ ok: true })
  }

  return respuesta({ error: 'Acción no reconocida.' }, 400)
})
