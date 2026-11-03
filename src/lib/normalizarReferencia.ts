/** Recorta espacios al inicio/final y junta espacios dobles en uno solo —
 * sin borrar los espacios que sí son parte del nombre de la marca. Hay
 * referencias del catálogo con espacio (p. ej. "CHIQUITA 404" o
 * "FSS19X7PBIFRA V1"); quitar todos los espacios (como se hacía antes)
 * impedía elegirlas o registrarlas porque ya no coincidían con el
 * catálogo. */
export function normalizarReferencia(referencia: string): string {
  return referencia.trim().replace(/\s+/g, ' ')
}
