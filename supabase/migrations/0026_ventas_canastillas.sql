-- ============================================================
-- Venta de canastillas: las canastillas producidas se venden a
-- terceros; se registra cada venta con la foto de la factura de
-- entrega, para comparar contra lo producido.
-- ============================================================
create table public.ventas_canastillas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  finca text not null references public.fincas (nombre),
  fecha date not null,
  semana integer not null check (semana between 1 and 53),
  cantidad integer not null check (cantidad > 0),
  factura_path text not null,
  notas text,
  created_at timestamptz not null default now()
);

create index ventas_canastillas_finca_fecha_idx
  on public.ventas_canastillas (finca, fecha desc);

alter table public.ventas_canastillas enable row level security;

create policy "Ver ventas de canastillas según rol"
  on public.ventas_canastillas for select
  using (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())));

create policy "Insertar ventas de canastillas según rol"
  on public.ventas_canastillas for insert
  with check (
    auth.uid() = user_id
    and (public.es_admin(auth.uid()) or finca = any (public.fincas_de(auth.uid())))
  );

create policy "Solo el admin actualiza ventas de canastillas"
  on public.ventas_canastillas for update
  using (public.es_admin(auth.uid()))
  with check (public.es_admin(auth.uid()));

create policy "Solo el admin elimina ventas de canastillas"
  on public.ventas_canastillas for delete
  using (public.es_admin(auth.uid()));

-- Fotos de las facturas de entrega (bucket privado de Storage, organizado
-- como "<finca>/<archivo>" para poder filtrar el acceso por finca).
insert into storage.buckets (id, name, public)
values ('facturas-canastillas', 'facturas-canastillas', false)
on conflict (id) do nothing;

create policy "Ver facturas de canastillas según rol"
  on storage.objects for select
  using (
    bucket_id = 'facturas-canastillas'
    and (public.es_admin(auth.uid()) or (storage.foldername(name))[1] = any (public.fincas_de(auth.uid())))
  );

create policy "Subir facturas de canastillas según rol"
  on storage.objects for insert
  with check (
    bucket_id = 'facturas-canastillas'
    and (public.es_admin(auth.uid()) or (storage.foldername(name))[1] = any (public.fincas_de(auth.uid())))
  );

create policy "Solo el admin elimina facturas de canastillas"
  on storage.objects for delete
  using (bucket_id = 'facturas-canastillas' and public.es_admin(auth.uid()));
