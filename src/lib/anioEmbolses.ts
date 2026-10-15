// El "año de embolses" de BANEX no es el año calendario: se nombra por el año
// calendario en que arranca (semana 42) y se ve hasta la semana 52 del año
// calendario siguiente — las semanas 42 en adelante de ese año siguiente ya
// pertenecen al próximo año de embolses, pero se siguen registrando dentro
// de ese año calendario, así que se muestran aquí también para no tener que
// cambiar de año a mitad de la captura semanal. Así, al entrar hoy a
// Embolses/Repiques, el selector arranca mostrando el año calendario actual
// (no el siguiente), que es el que coincide con lo que el operario ve en
// Registrar. BANEX siempre maneja años de 52 semanas (sin la semana 53 que a
// veces trae el calendario ISO), así que el rango es fijo: 42..52 del año en
// que arranca + 1..52 del año siguiente, 63 columnas siempre.

export interface SemanaReal {
  anio: number
  semana: number
}

/** Las 52 semanas (1 a 52) de un año calendario simple, sin dividir por
 * temporadas — para los menús de consulta (Embolses, Repiques, Recobro),
 * donde cada año se ve completo hasta que se cierra, sin importar que la
 * cinta/edad de un registro individual pueda referirse a una semana del año
 * anterior o siguiente. */
export function semanasDelAnio(anio: number): SemanaReal[] {
  const semanas: SemanaReal[] = []
  for (let s = 1; s <= 52; s++) semanas.push({ anio, semana: s })
  return semanas
}

/** Lista ordenada de semanas reales (año/semana) que componen un "año de
 * embolses" — se sigue usando solo para el ciclo de cinta al registrar
 * (Registro de embolse / Registro de repique), donde sí hace falta ver unas
 * semanas del año anterior o siguiente dentro de la misma pantalla. */
export function semanasDelAnioEmbolses(anioEmbolses: number): SemanaReal[] {
  const semanas: SemanaReal[] = []
  const anioSiguiente = anioEmbolses + 1
  for (let s = 42; s <= 52; s++) semanas.push({ anio: anioEmbolses, semana: s })
  for (let s = 1; s <= 52; s++) semanas.push({ anio: anioSiguiente, semana: s })
  return semanas
}

/** A qué "año de embolses" pertenece una semana real dada. */
export function anioEmbolsesDe(anio: number, semana: number): number {
  return semana >= 42 ? anio : anio - 1
}

/** Suma (o resta) semanas a una semana real, con años de 52 semanas (igual
 * que semanasDelAnioEmbolses) — pensado para saltos chicos (unas pocas
 * semanas), no para contar un año completo. */
export function sumarSemanas(anio: number, semana: number, delta: number): SemanaReal {
  let total = semana + delta
  let a = anio
  while (total > 52) {
    total -= 52
    a += 1
  }
  while (total < 1) {
    total += 52
    a -= 1
  }
  return { anio: a, semana: total }
}
