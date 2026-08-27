/**
 * Fecha de hoy en formato YYYY-MM-DD según la hora local del dispositivo.
 * `Date.toISOString()` convierte a UTC antes de formatear, así que en
 * Colombia (UTC-5) ya marca el día siguiente desde las 7pm hora local —
 * por eso los registros se guardaban con la fecha de mañana en la noche.
 */
export function fechaLocalHoy(): string {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}
