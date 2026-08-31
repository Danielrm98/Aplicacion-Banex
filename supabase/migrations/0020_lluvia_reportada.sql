-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Permite reportar manualmente los milímetros de lluvia realmente caídos
-- en una finca en un día — un operador puede registrarla el día que
-- quiera (aunque hayan pasado varios días) y corregirla después si se
-- equivocó. Este dato reemplaza al estimado del pronóstico en el
-- historial de lluvia cuando existe.

create table public.lluvia_reportada (
  id uuid primary key default gen_random_uuid(),
  finca text not null references public.fincas (nombre),
  fecha date not null,
  milimetros numeric not null check (milimetros >= 0),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (finca, fecha)
);

alter table public.lluvia_reportada enable row level security;

create policy "Ver lluvia reportada según rol"
  on public.lluvia_reportada for select
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

create policy "Insertar lluvia reportada según rol"
  on public.lluvia_reportada for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  );

create policy "Actualizar lluvia reportada según rol"
  on public.lluvia_reportada for update
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()))
  with check (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));

create policy "Eliminar lluvia reportada según rol"
  on public.lluvia_reportada for delete
  using (public.es_admin(auth.uid()) or finca = public.finca_de(auth.uid()));
