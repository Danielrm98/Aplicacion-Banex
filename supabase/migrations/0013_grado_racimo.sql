-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega el promedio de grado de fruta por cada semana de edad del racimo
-- (7 a 12), junto a los racimos cosechados.

alter table public.producciones
  add column if not exists grado_semana_7 numeric,
  add column if not exists grado_semana_8 numeric,
  add column if not exists grado_semana_9 numeric,
  add column if not exists grado_semana_10 numeric,
  add column if not exists grado_semana_11 numeric,
  add column if not exists grado_semana_12 numeric;
