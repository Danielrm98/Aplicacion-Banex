-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega el número de racimos recusados (cosechados pero no procesados) a la
-- cabecera de cada registro. Racimos procesados = cosechados - recusados,
-- se calcula en la app y no requiere columna propia.

alter table public.producciones
  add column if not exists racimos_recusados integer not null default 0 check (racimos_recusados >= 0);
