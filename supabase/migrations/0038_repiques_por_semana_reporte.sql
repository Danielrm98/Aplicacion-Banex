-- Antes, "repiques" guardaba un solo total acumulado por (lote, semana de
-- embolse): cada semana que se volvía a repicar esa misma cinta, el nuevo
-- total reemplazaba al anterior en la misma fila. Eso no permitía ver qué
-- se reportó en cada semana en particular (siempre se veía "el acumulado"),
-- ni dejar en blanco la semana nueva sin perder de vista lo ya reportado en
-- semanas pasadas para esa misma cinta.
--
-- Ahora cada semana de reporte (anio_reporte/semana_reporte) guarda su
-- propia fila por lote y edad — igual que cualquier otra casilla editable
-- de la app (se corrige volviendo a guardar esa misma celda). Al abrir una
-- semana ya reportada, se ve exactamente lo que se registró esa semana; al
-- abrir una semana nueva, no hay fila todavía y la casilla aparece vacía.
-- anio_embolse/semana_embolse se mantienen (recalculados a partir de
-- anio_reporte + semana_reporte + edad) para poder sumar fácil, al
-- consultar, todo lo repicado de una misma semana de embolse sin importar
-- en qué semana de reporte se haya ido registrando cada parte.

alter table public.repiques add column anio_reporte integer;
alter table public.repiques add column semana_reporte integer;

-- Para las filas ya existentes (importadas antes de este cambio, con un
-- solo total acumulado por semana de embolse): se asume que se reportaron
-- en su propia semana de embolse con edad 0, para no dejar filas sin
-- anio_reporte/semana_reporte. No es exacto para el histórico ya importado
-- (se pierde el detalle de en qué semana se fue reportando cada parte),
-- pero no afecta los totales ya calculados ni los registros nuevos.
update public.repiques set anio_reporte = anio_embolse, semana_reporte = semana_embolse where anio_reporte is null;

alter table public.repiques alter column anio_reporte set not null;
alter table public.repiques alter column semana_reporte set not null;
alter table public.repiques add constraint repiques_semana_reporte_check check (semana_reporte between 1 and 53);

alter table public.repiques drop constraint if exists repiques_lote_id_anio_embolse_semana_embolse_key;
alter table public.repiques add constraint repiques_lote_reporte_edad_key
  unique (lote_id, anio_reporte, semana_reporte, edad_semanas);
