-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Quita el campo calibre y agrega cajas_20kg (cantidad_cajas x factor_conversion
-- de la referencia), calculado y guardado al momento de crear cada línea.

alter table public.produccion_items
  drop column if exists calibre;

alter table public.produccion_items
  add column if not exists cajas_20kg numeric not null default 0 check (cajas_20kg >= 0);

alter table public.produccion_items
  alter column cajas_20kg drop default;
