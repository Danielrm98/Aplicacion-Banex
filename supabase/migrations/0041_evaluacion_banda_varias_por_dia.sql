-- "Evaluación de banda" deja de ser una sola por finca/día (se necesitan
-- al menos 3 durante el proceso), y deja de ser un historial permanente:
-- es solo informativa para el día en curso. La purga de lo viejo la hace
-- la propia app al guardar (borra lo de días anteriores de esa finca), así
-- que aquí solo se ajustan las restricciones que ya no aplican.
alter table public.evaluaciones_banda
  drop constraint if exists evaluaciones_banda_finca_fecha_key;

drop policy if exists "Insertar evaluaciones de banda según rol" on public.evaluaciones_banda;

create policy "Insertar evaluaciones de banda según rol"
  on public.evaluaciones_banda for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())))
  );

drop function if exists public.existe_evaluacion_banda_mismo_dia(text, date);

-- Ya no es un registro protegido: cualquiera con acceso a esa finca puede
-- borrar lo de días anteriores (el admin conserva permiso total).
drop policy if exists "Solo el admin elimina evaluaciones de banda" on public.evaluaciones_banda;

create policy "Eliminar evaluaciones de banda según rol"
  on public.evaluaciones_banda for delete
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));
