-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega el número de canastillas generadas a la cabecera de cada registro.
-- El peso neto de racimo (cajas 20kg + canastillas, entre racimos cosechados)
-- se calcula en la app a partir de este dato y no requiere columna propia.

alter table public.producciones
  add column if not exists canastillas integer not null default 0 check (canastillas >= 0);
