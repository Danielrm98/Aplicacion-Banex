-- Hasta ahora, escalera_embolse_historico solo se llenaba una vez con un
-- script corriendo con la service role key. Para el panel de "Importar
-- Excel" dentro de la app, el administrador necesita poder insertar y
-- corregir estas filas con su propia sesión (nunca se expone la service
-- role key en el navegador).
create policy "Solo el admin crea historico de embolse"
  on public.escalera_embolse_historico for insert
  with check (public.es_admin(auth.uid()));

create policy "Solo el admin corrige historico de embolse"
  on public.escalera_embolse_historico for update
  using (public.es_admin(auth.uid()))
  with check (public.es_admin(auth.uid()));
