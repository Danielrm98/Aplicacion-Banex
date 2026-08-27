-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Agrega la posibilidad de subir un PDF de especificaciones (fruta,
-- empaque y paletizado) por cada referencia del catálogo.
-- El PDF se guarda en un bucket privado de Storage; solo un admin puede
-- subir/reemplazar/eliminar, cualquier usuario autenticado puede verlo.

alter table public.referencias
  add column if not exists especificacion_pdf_path text;

insert into storage.buckets (id, name, public)
values ('especificaciones', 'especificaciones', false)
on conflict (id) do nothing;

drop policy if exists "Usuarios autenticados ven especificaciones" on storage.objects;
create policy "Usuarios autenticados ven especificaciones"
  on storage.objects for select
  using (bucket_id = 'especificaciones' and auth.role() = 'authenticated');

drop policy if exists "Solo el admin sube especificaciones" on storage.objects;
create policy "Solo el admin sube especificaciones"
  on storage.objects for insert
  with check (bucket_id = 'especificaciones' and public.es_admin(auth.uid()));

drop policy if exists "Solo el admin reemplaza especificaciones" on storage.objects;
create policy "Solo el admin reemplaza especificaciones"
  on storage.objects for update
  using (bucket_id = 'especificaciones' and public.es_admin(auth.uid()))
  with check (bucket_id = 'especificaciones' and public.es_admin(auth.uid()));

drop policy if exists "Solo el admin elimina especificaciones" on storage.objects;
create policy "Solo el admin elimina especificaciones"
  on storage.objects for delete
  using (bucket_id = 'especificaciones' and public.es_admin(auth.uid()));
