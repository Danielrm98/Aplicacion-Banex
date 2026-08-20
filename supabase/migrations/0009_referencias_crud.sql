-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Permite crear y eliminar referencias del catálogo desde la app
-- (antes solo se podían leer, había que usar el SQL Editor para cambiarlas).

create policy "Usuarios autenticados crean referencias"
  on public.referencias for insert
  with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados eliminan referencias"
  on public.referencias for delete
  using (auth.role() = 'authenticated');
