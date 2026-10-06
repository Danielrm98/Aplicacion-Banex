export function getIsoWeek(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00')
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

/** Año ISO al que pertenece la fecha (puede ser distinto del año calendario en los primeros/últimos días). */
export function getIsoYear(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00Z')
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  return date.getUTCFullYear()
}

/**
 * Año de una semana registrada para una fecha dada. Normalmente la semana es
 * la de la fecha misma o una cercana; si difiere mucho (p. ej. venta en la
 * semana 1 correspondiente a la 52), la semana cae en el año anterior o siguiente.
 */
export function anioDeSemana(fecha: string, semana: number): number {
  const anio = getIsoYear(fecha)
  const semanaFecha = getIsoWeek(fecha)
  if (semana - semanaFecha > 26) return anio - 1
  if (semanaFecha - semana > 26) return anio + 1
  return anio
}
