-- "Registro de embolse": cada finca reporta el embolse semanal por lote en
-- dos vueltas (1ra y 2da pasada) más el debunching, igual al formato físico
-- que ya manejan. cantidad sigue siendo el total (primera + segunda) que ya
-- usa el resumen general de Embolses; estas columnas nuevas son la captura
-- detallada que alimenta ese total.

alter table public.embolses add column primera_vuelta integer;
alter table public.embolses add column segunda_vuelta integer;
alter table public.embolses add column debunching integer;
