-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega el registro de llegadas/salidas de transporte (camión o contenedor)
-- por cada registro de producción.

create table public.transportes (
  id uuid primary key default gen_random_uuid(),
  produccion_id uuid not null references public.producciones (id) on delete cascade,
  tipo text not null check (tipo in ('Contenedor', 'Camión')),
  hora_llegada time,
  hora_salida time,
  created_at timestamptz not null default now()
);

create index transportes_produccion_idx
  on public.transportes (produccion_id);

alter table public.transportes enable row level security;

create policy "Los usuarios ven transportes de sus registros"
  on public.transportes for select
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios insertan transportes en sus registros"
  on public.transportes for insert
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios actualizan transportes de sus registros"
  on public.transportes for update
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ));

create policy "Los usuarios eliminan transportes de sus registros"
  on public.transportes for delete
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id and p.user_id = auth.uid()
  ));
