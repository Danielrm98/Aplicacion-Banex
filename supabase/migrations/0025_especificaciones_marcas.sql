-- Permite subir la hoja de especificaciones (PDF) de una marca aunque esa
-- marca todavía no esté registrada como referencia del catálogo de
-- producción — útil porque la especificación se actualiza de versión sin
-- que necesariamente cambie (ni exista todavía) la referencia productiva.
create table public.especificaciones_marcas (
  marca text primary key,
  pdf_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.especificaciones_marcas enable row level security;

create policy "Usuarios autenticados leen especificaciones de marcas"
  on public.especificaciones_marcas for select
  using (auth.role() = 'authenticated');

create policy "Solo el admin agrega especificaciones de marcas"
  on public.especificaciones_marcas for insert
  with check (public.es_admin(auth.uid()));

create policy "Solo el admin actualiza especificaciones de marcas"
  on public.especificaciones_marcas for update
  using (public.es_admin(auth.uid()))
  with check (public.es_admin(auth.uid()));

create policy "Solo el admin elimina especificaciones de marcas"
  on public.especificaciones_marcas for delete
  using (public.es_admin(auth.uid()));
