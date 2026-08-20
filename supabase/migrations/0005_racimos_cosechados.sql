-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega el registro de racimos cosechados por semana de edad (7 a 12) a la
-- cabecera de cada registro de producción.

alter table public.producciones
  add column if not exists racimos_semana_7 integer not null default 0 check (racimos_semana_7 >= 0),
  add column if not exists racimos_semana_8 integer not null default 0 check (racimos_semana_8 >= 0),
  add column if not exists racimos_semana_9 integer not null default 0 check (racimos_semana_9 >= 0),
  add column if not exists racimos_semana_10 integer not null default 0 check (racimos_semana_10 >= 0),
  add column if not exists racimos_semana_11 integer not null default 0 check (racimos_semana_11 >= 0),
  add column if not exists racimos_semana_12 integer not null default 0 check (racimos_semana_12 >= 0);
