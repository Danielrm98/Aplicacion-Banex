-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Permite editar referencias existentes desde la app
-- (antes solo se podían crear y eliminar, faltaba la política de update).

create policy "Usuarios autenticados editan referencias"
  on public.referencias for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
