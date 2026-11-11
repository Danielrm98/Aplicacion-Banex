-- Nuevo rol "admin_lectura" (Administrador 2): ve exactamente lo mismo que
-- el admin para las fincas que se le asignen (igual que un operador, por
-- perfil_fincas), pero no puede crear, editar ni eliminar nada — ni
-- siquiera lo de su propia finca asignada. Se bloquea a nivel de base de
-- datos (no solo ocultando botones en la app) para que no haya forma de
-- escribir aunque se llame a la API directamente.

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('admin', 'operador', 'admin_lectura'));

create or replace function public.es_admin_lectura(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select rol = 'admin_lectura' from public.perfiles where user_id = uid), false);
$$;

-- Mismo conjunto de fincas que fincas_de(), pero vacío para admin_lectura:
-- así todas las políticas de escritura que ya comparaban contra
-- fincas_de() quedan bloqueadas para este rol sin tener que inventar una
-- condición aparte en cada tabla.
create or replace function public.fincas_escritura(uid uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select case when public.es_admin_lectura(uid) then array[]::text[] else public.fincas_de(uid) end;
$$;

-- ============================================================
-- Perfiles / fincas asignadas: el admin_lectura necesita ver la pestaña
-- Usuarios del Catálogo igual que el admin (aunque no pueda tocar nada ahí).
-- ============================================================
drop policy if exists "Cada quien ve su perfil, el admin ve todos" on public.perfiles;
create policy "Cada quien ve su perfil, el admin ve todos"
  on public.perfiles for select
  using (auth.uid() = user_id or public.es_admin(auth.uid()) or public.es_admin_lectura(auth.uid()));

drop policy if exists "Cada quien ve sus fincas asignadas, el admin ve todas" on public.perfil_fincas;
create policy "Cada quien ve sus fincas asignadas, el admin ve todas"
  on public.perfil_fincas for select
  using (auth.uid() = user_id or public.es_admin(auth.uid()) or public.es_admin_lectura(auth.uid()));

-- ============================================================
-- Catálogo (referencias y fincas): hoy cualquier usuario autenticado puede
-- escribir el catálogo (no solo el admin); se le suma la excepción del
-- admin_lectura para que, aunque lo vea, no pueda tocarlo.
-- ============================================================
drop policy if exists "Usuarios autenticados crean referencias" on public.referencias;
create policy "Usuarios autenticados crean referencias"
  on public.referencias for insert
  with check (auth.role() = 'authenticated' and not public.es_admin_lectura(auth.uid()));

drop policy if exists "Usuarios autenticados eliminan referencias" on public.referencias;
create policy "Usuarios autenticados eliminan referencias"
  on public.referencias for delete
  using (auth.role() = 'authenticated' and not public.es_admin_lectura(auth.uid()));

drop policy if exists "Usuarios autenticados editan referencias" on public.referencias;
create policy "Usuarios autenticados editan referencias"
  on public.referencias for update
  using (auth.role() = 'authenticated' and not public.es_admin_lectura(auth.uid()))
  with check (auth.role() = 'authenticated' and not public.es_admin_lectura(auth.uid()));

drop policy if exists "Usuarios autenticados agregan fincas" on public.fincas;
create policy "Usuarios autenticados agregan fincas"
  on public.fincas for insert
  with check (auth.role() = 'authenticated' and not public.es_admin_lectura(auth.uid()));

drop policy if exists "Usuarios autenticados actualizan el hectareaje" on public.fincas;
create policy "Usuarios autenticados actualizan el hectareaje"
  on public.fincas for update
  using (auth.role() = 'authenticated' and not public.es_admin_lectura(auth.uid()))
  with check (auth.role() = 'authenticated' and not public.es_admin_lectura(auth.uid()));

-- ============================================================
-- Lluvia reportada
-- ============================================================
drop policy if exists "Insertar lluvia reportada según rol" on public.lluvia_reportada;
create policy "Insertar lluvia reportada según rol"
  on public.lluvia_reportada for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  );

drop policy if exists "Actualizar lluvia reportada según rol" on public.lluvia_reportada;
create policy "Actualizar lluvia reportada según rol"
  on public.lluvia_reportada for update
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

drop policy if exists "Eliminar lluvia reportada según rol" on public.lluvia_reportada;
create policy "Eliminar lluvia reportada según rol"
  on public.lluvia_reportada for delete
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

-- ============================================================
-- Producciones + items + transportes
-- ============================================================
drop policy if exists "Insertar producciones según rol" on public.producciones;
create policy "Insertar producciones según rol"
  on public.producciones for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or (
        finca = any (public.fincas_escritura(auth.uid()))
        and not public.existe_produccion_mismo_dia(finca, fecha)
      )
    )
  );

drop policy if exists "Actualizar producciones según rol" on public.producciones;
create policy "Actualizar producciones según rol"
  on public.producciones for update
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

drop policy if exists "Insertar items según rol" on public.produccion_items;
create policy "Insertar items según rol"
  on public.produccion_items for insert
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ));

drop policy if exists "Actualizar items según rol" on public.produccion_items;
create policy "Actualizar items según rol"
  on public.produccion_items for update
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ))
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ));

drop policy if exists "Insertar transportes según rol" on public.transportes;
create policy "Insertar transportes según rol"
  on public.transportes for insert
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ));

drop policy if exists "Actualizar transportes según rol" on public.transportes;
create policy "Actualizar transportes según rol"
  on public.transportes for update
  using (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ))
  with check (exists (
    select 1 from public.producciones p
    where p.id = produccion_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ));

-- ============================================================
-- Venta de canastillas (+ facturas en Storage)
-- ============================================================
drop policy if exists "Insertar ventas de canastillas según rol" on public.ventas_canastillas;
create policy "Insertar ventas de canastillas según rol"
  on public.ventas_canastillas for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  );

drop policy if exists "Actualizar ventas de canastillas según rol" on public.ventas_canastillas;
create policy "Actualizar ventas de canastillas según rol"
  on public.ventas_canastillas for update
  using (
    public.es_admin(auth.uid())
    or (finca = any (public.fincas_escritura(auth.uid())) and factura_path is null)
  )
  with check (
    public.es_admin(auth.uid())
    or finca = any (public.fincas_escritura(auth.uid()))
  );

drop policy if exists "Subir facturas de canastillas según rol" on storage.objects;
create policy "Subir facturas de canastillas según rol"
  on storage.objects for insert
  with check (
    bucket_id = 'facturas-canastillas'
    and (public.es_admin(auth.uid()) or (storage.foldername(name))[1] = any (public.fincas_escritura(auth.uid())))
  );

drop policy if exists "Actualizar facturas de canastillas según rol" on storage.objects;
create policy "Actualizar facturas de canastillas según rol"
  on storage.objects for update
  using (
    bucket_id = 'facturas-canastillas'
    and (public.es_admin(auth.uid()) or (storage.foldername(name))[1] = any (public.fincas_escritura(auth.uid())))
  )
  with check (
    bucket_id = 'facturas-canastillas'
    and (public.es_admin(auth.uid()) or (storage.foldername(name))[1] = any (public.fincas_escritura(auth.uid())))
  );

-- ============================================================
-- Plan semanal + items
-- ============================================================
drop policy if exists "Crear planes según rol" on public.planes_semana;
create policy "Crear planes según rol"
  on public.planes_semana for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  );

drop policy if exists "Actualizar planes según rol" on public.planes_semana;
create policy "Actualizar planes según rol"
  on public.planes_semana for update
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

drop policy if exists "Eliminar planes según rol" on public.planes_semana;
create policy "Eliminar planes según rol"
  on public.planes_semana for delete
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

drop policy if exists "Insertar items de plan según rol" on public.plan_items;
create policy "Insertar items de plan según rol"
  on public.plan_items for insert
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ));

drop policy if exists "Actualizar items de plan según rol" on public.plan_items;
create policy "Actualizar items de plan según rol"
  on public.plan_items for update
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ))
  with check (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ));

drop policy if exists "Eliminar items de plan según rol" on public.plan_items;
create policy "Eliminar items de plan según rol"
  on public.plan_items for delete
  using (exists (
    select 1 from public.planes_semana p
    where p.id = plan_id
      and (public.es_admin(auth.uid()) or p.finca = any (public.fincas_escritura(auth.uid())))
  ));

-- ============================================================
-- Embolses / Repiques / Censo de plantas (por lote -> finca)
-- ============================================================
drop policy if exists "Registrar embolses según rol" on public.embolses;
create policy "Registrar embolses según rol"
  on public.embolses for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = embolses.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
      )
    )
  );

drop policy if exists "Corregir embolses según rol" on public.embolses;
create policy "Corregir embolses según rol"
  on public.embolses for update
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = embolses.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
    )
  )
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = embolses.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
      )
    )
  );

drop policy if exists "Registrar repiques según rol" on public.repiques;
create policy "Registrar repiques según rol"
  on public.repiques for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = repiques.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
      )
    )
  );

drop policy if exists "Corregir repiques según rol" on public.repiques;
create policy "Corregir repiques según rol"
  on public.repiques for update
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = repiques.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
    )
  )
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = repiques.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
      )
    )
  );

drop policy if exists "Registrar censo de plantas según rol" on public.censo_plantas;
create policy "Registrar censo de plantas según rol"
  on public.censo_plantas for insert
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = censo_plantas.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
      )
    )
  );

drop policy if exists "Corregir censo de plantas según rol" on public.censo_plantas;
create policy "Corregir censo de plantas según rol"
  on public.censo_plantas for update
  using (
    public.es_admin(auth.uid())
    or exists (
      select 1 from public.lotes l
      where l.id = censo_plantas.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
    )
  )
  with check (
    auth.uid() = user_id
    and (
      public.es_admin(auth.uid())
      or exists (
        select 1 from public.lotes l
        where l.id = censo_plantas.lote_id and l.finca = any (public.fincas_escritura(auth.uid()))
      )
    )
  );

-- ============================================================
-- Evaluación de banda + items
-- ============================================================
drop policy if exists "Insertar evaluaciones de banda según rol" on public.evaluaciones_banda;
create policy "Insertar evaluaciones de banda según rol"
  on public.evaluaciones_banda for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  );

drop policy if exists "Actualizar evaluaciones de banda según rol" on public.evaluaciones_banda;
create policy "Actualizar evaluaciones de banda según rol"
  on public.evaluaciones_banda for update
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

drop policy if exists "Eliminar evaluaciones de banda según rol" on public.evaluaciones_banda;
create policy "Eliminar evaluaciones de banda según rol"
  on public.evaluaciones_banda for delete
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

drop policy if exists "Insertar items de evaluación de banda según rol" on public.evaluacion_banda_items;
create policy "Insertar items de evaluación de banda según rol"
  on public.evaluacion_banda_items for insert
  with check (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));

drop policy if exists "Actualizar items de evaluación de banda según rol" on public.evaluacion_banda_items;
create policy "Actualizar items de evaluación de banda según rol"
  on public.evaluacion_banda_items for update
  using (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ))
  with check (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));

drop policy if exists "Eliminar items de evaluación de banda según rol" on public.evaluacion_banda_items;
create policy "Eliminar items de evaluación de banda según rol"
  on public.evaluacion_banda_items for delete
  using (exists (
    select 1 from public.evaluaciones_banda e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));
