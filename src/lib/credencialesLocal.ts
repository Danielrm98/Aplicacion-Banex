const CLAVE = 'approban_credenciales_offline'

interface Huella {
  hash: string
  salt: string
}

function bytesAHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashear(password: string, saltHex: string): Promise<string> {
  const datos = new TextEncoder().encode(`${saltHex}:${password}`)
  const buffer = await crypto.subtle.digest('SHA-256', datos)
  return bytesAHex(new Uint8Array(buffer))
}

function leerTodas(): Record<string, Huella> {
  try {
    const bruto = localStorage.getItem(CLAVE)
    return bruto ? (JSON.parse(bruto) as Record<string, Huella>) : {}
  } catch {
    return {}
  }
}

function guardarTodas(datos: Record<string, Huella>) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos))
  } catch {
    // Sin espacio o localStorage no disponible: no queda guardada la huella
    // para iniciar sesión sin señal la próxima vez, pero el inicio de
    // sesión en línea de ahora no se ve afectado.
  }
}

/**
 * Guarda, solo en este dispositivo, una huella (nunca la contraseña en sí)
 * de la última contraseña que sí funcionó con conexión para este usuario.
 * Se usa para poder confirmarla sin red la próxima vez, en vez de obligar a
 * tener señal para poder entrar a la app. La sal evita que dos usuarios con
 * la misma contraseña queden con la misma huella guardada.
 */
export async function guardarCredencialOffline(email: string, password: string): Promise<void> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return
    const salt = bytesAHex(crypto.getRandomValues(new Uint8Array(16)))
    const hash = await hashear(password, salt)
    const todas = leerTodas()
    todas[email.toLowerCase()] = { hash, salt }
    guardarTodas(todas)
  } catch {
    // No queda habilitado el inicio de sesión sin señal para este usuario,
    // pero no debe impedir que el inicio de sesión en línea siga su curso.
  }
}

/** Sin ninguna huella guardada para ese usuario (nunca inició sesión antes en este celular), no hay forma de confirmar la contraseña sin conexión. */
export async function verificarCredencialOffline(email: string, password: string): Promise<boolean> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return false
    const huella = leerTodas()[email.toLowerCase()]
    if (!huella) return false
    const hash = await hashear(password, huella.salt)
    return hash === huella.hash
  } catch {
    return false
  }
}
