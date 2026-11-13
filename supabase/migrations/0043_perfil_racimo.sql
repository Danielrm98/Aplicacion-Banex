-- "Perfil de racimo y merma": muestreo de 10 racimos por evaluación, con
-- mediciones de peso/grado por racimo y conteo de defectos agrupados igual
-- que el formulario en papel que ya usan las fincas (Cosecha, Cultivo,
-- Empacadora, Ambiente, Animal, Enfermedad). Una finca puede guardar varias
-- evaluaciones el mismo día (mañana/tarde). A diferencia de "Evaluación de
-- banda", este sí es un historial permanente (no se purga solo).

create table public.perfil_racimo_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  finca text not null references public.fincas (nombre),
  fecha date not null,
  semana integer not null check (semana between 1 and 53),
  created_at timestamptz not null default now()
);

create index perfil_racimo_evaluaciones_finca_fecha_idx
  on public.perfil_racimo_evaluaciones (finca, fecha desc);

alter table public.perfil_racimo_evaluaciones enable row level security;

create policy "Ver perfiles de racimo según rol"
  on public.perfil_racimo_evaluaciones for select
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

create policy "Insertar perfiles de racimo según rol"
  on public.perfil_racimo_evaluaciones for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  );

create policy "Actualizar perfiles de racimo según rol"
  on public.perfil_racimo_evaluaciones for update
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())))
  with check (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

create policy "Eliminar perfiles de racimo según rol"
  on public.perfil_racimo_evaluaciones for delete
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_escritura(auth.uid())));

-- ============================================================
-- Mediciones por cada uno de los 10 racimos de la muestra
-- ============================================================
create table public.perfil_racimo_muestras (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.perfil_racimo_evaluaciones (id) on delete cascade,
  numero_muestra integer not null check (numero_muestra between 1 and 10),
  hora text,
  lote text,
  no_racimo text,
  edad_cinta text,
  grado_sudbasal numeric,
  grado_apical numeric,
  no_manos numeric,
  largo_apical numeric,
  -- A, B, C, D del formulario; E, F, G, H, I se calculan en la app, no se
  -- guardan (se recalculan solas a partir de estas cuatro).
  peso_fruta_premium numeric check (peso_fruta_premium >= 0),
  peso_fruta_corta numeric check (peso_fruta_corta >= 0),
  peso_merma numeric check (peso_merma >= 0),
  vastago_corona numeric check (vastago_corona >= 0),
  created_at timestamptz not null default now(),
  unique (evaluacion_id, numero_muestra)
);

create index perfil_racimo_muestras_evaluacion_idx
  on public.perfil_racimo_muestras (evaluacion_id);

alter table public.perfil_racimo_muestras enable row level security;

create policy "Ver muestras de perfil de racimo según rol"
  on public.perfil_racimo_muestras for select
  using (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_de(auth.uid())))
  ));

create policy "Insertar muestras de perfil de racimo según rol"
  on public.perfil_racimo_muestras for insert
  with check (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));

create policy "Actualizar muestras de perfil de racimo según rol"
  on public.perfil_racimo_muestras for update
  using (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ))
  with check (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));

create policy "Eliminar muestras de perfil de racimo según rol"
  on public.perfil_racimo_muestras for delete
  using (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));

-- ============================================================
-- Conteo de defectos por racimo, agrupados igual que el papel
-- ============================================================
create table public.perfil_racimo_defectos (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.perfil_racimo_evaluaciones (id) on delete cascade,
  numero_muestra integer not null check (numero_muestra between 1 and 10),
  grupo text not null,
  defecto text not null,
  cantidad integer not null check (cantidad > 0),
  created_at timestamptz not null default now(),
  unique (evaluacion_id, numero_muestra, grupo, defecto)
);

create index perfil_racimo_defectos_evaluacion_idx
  on public.perfil_racimo_defectos (evaluacion_id);

alter table public.perfil_racimo_defectos enable row level security;

create policy "Ver defectos de perfil de racimo según rol"
  on public.perfil_racimo_defectos for select
  using (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_de(auth.uid())))
  ));

create policy "Insertar defectos de perfil de racimo según rol"
  on public.perfil_racimo_defectos for insert
  with check (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));

create policy "Actualizar defectos de perfil de racimo según rol"
  on public.perfil_racimo_defectos for update
  using (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ))
  with check (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));

create policy "Eliminar defectos de perfil de racimo según rol"
  on public.perfil_racimo_defectos for delete
  using (exists (
    select 1 from public.perfil_racimo_evaluaciones e
    where e.id = evaluacion_id
      and (public.es_admin(auth.uid()) or e.finca = any (public.fincas_escritura(auth.uid())))
  ));
