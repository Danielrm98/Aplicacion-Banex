// El "año de embolses" de BANEX no es el año calendario: siempre arranca en
// la semana ISO 42 del año calendario anterior (esos racimos se cosechan ya
// entrado el año siguiente) y llega hasta la semana 41 del año en curso.

function pDeAnio(anio: number): number {
  return (anio + Math.floor(anio / 4) - Math.floor(anio / 100) + Math.floor(anio / 400)) % 7
}

/** 52 o 53, según la regla ISO 8601 de años con semana 53. */
export function semanasIsoEnAnio(anio: number): 52 | 53 {
  return pDeAnio(anio) === 4 || pDeAnio(anio - 1) === 3 ? 53 : 52
}

export interface SemanaReal {
  anio: number
  semana: number
}

/** Lista ordenada de semanas reales (año/semana) que componen un "año de embolses". */
export function semanasDelAnioEmbolses(anioEmbolses: number): SemanaReal[] {
  const semanas: SemanaReal[] = []
  const anioAnterior = anioEmbolses - 1
  for (let s = 42; s <= semanasIsoEnAnio(anioAnterior); s++) semanas.push({ anio: anioAnterior, semana: s })
  for (let s = 1; s <= 41; s++) semanas.push({ anio: anioEmbolses, semana: s })
  return semanas
}

/** A qué "año de embolses" pertenece una semana real dada. */
export function anioEmbolsesDe(anio: number, semana: number): number {
  return semana >= 42 ? anio + 1 : anio
}
