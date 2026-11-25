-- Permite al administrador "modelar" a mano el % de racimos por edad (y
-- por lo tanto el recobro) que usa la escalera para proyectar, en vez de
-- depender siempre del cálculo automático (última cohorte de embolse ya
-- completa). Si una finca tiene filas aquí, la escalera las usa tal cual;
-- si no tiene ninguna, sigue usando el cálculo automático de siempre.
create table public.escalera_modelo_edad (
  finca text not null references public.fincas (nombre),
  edad_semanas integer not null check (edad_semanas between 7 and 13),
  -- % del embolse (no normalizado a 1 entre las 7 edades): la suma de las
  -- 7 filas de una finca es su recobro total modelado.
  porcentaje numeric not null check (porcentaje >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (finca, edad_semanas)
);

alter table public.escalera_modelo_edad enable row level security;

create policy "Ver modelo de escalera según rol"
  on public.escalera_modelo_edad for select
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

-- Solo el administrador (no admin_lectura, no operario) puede modelar:
-- coincide con que todo el menú "Escalera de producción" ya es solo-admin.
create policy "Solo el admin crea el modelo de escalera"
  on public.escalera_modelo_edad for insert
  with check (public.es_admin(auth.uid()));

create policy "Solo el admin corrige el modelo de escalera"
  on public.escalera_modelo_edad for update
  using (public.es_admin(auth.uid()))
  with check (public.es_admin(auth.uid()));

create policy "Solo el admin elimina el modelo de escalera"
  on public.escalera_modelo_edad for delete
  using (public.es_admin(auth.uid()));
