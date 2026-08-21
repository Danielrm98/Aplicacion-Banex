-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega el catálogo de fincas (hectareaje total) y el campo de área
-- recorrida del día en cada registro de producción.

create table if not exists public.fincas (
  nombre text primary key,
  hectareas numeric check (hectareas >= 0)
);

alter table public.fincas enable row level security;

drop policy if exists "Usuarios autenticados leen el catálogo de fincas" on public.fincas;
create policy "Usuarios autenticados leen el catálogo de fincas"
  on public.fincas for select
  using (auth.role() = 'authenticated');

drop policy if exists "Usuarios autenticados agregan fincas" on public.fincas;
create policy "Usuarios autenticados agregan fincas"
  on public.fincas for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Usuarios autenticados actualizan el hectareaje" on public.fincas;
create policy "Usuarios autenticados actualizan el hectareaje"
  on public.fincas for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into public.fincas (nombre) values
  ('TAMACARA'),
  ('FLORIDA'),
  ('LAS DELICIAS'),
  ('DILIA ESTHER'),
  ('GOLONDRINA NUEVA'),
  ('GOLONDRINA VIEJA'),
  ('GLORIA MERCEDES'),
  ('LUCILA MARINA'),
  ('ESMERALDA'),
  ('LA MARIA'),
  ('TROPICANA'),
  ('COSTANERA'),
  ('RAQUELITA'),
  ('MILADY'),
  ('MACONDO')
on conflict (nombre) do nothing;

alter table public.producciones
  add column if not exists area_recorrida numeric check (area_recorrida >= 0);
