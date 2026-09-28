-- Ya no es obligatorio adjuntar la foto de la factura al registrar una
-- salida: el operario puede guardarla sin foto y agregarla después. Un
-- operario (no solo el admin) puede entonces "completar" esa venta
-- adjuntando la factura pendiente, pero solo eso — no puede editar
-- cantidades ni otros datos de una venta ya guardada.

alter table public.ventas_canastillas alter column factura_path drop not null;

drop policy "Solo el admin actualiza ventas de canastillas" on public.ventas_canastillas;

create policy "Actualizar ventas de canastillas según rol"
  on public.ventas_canastillas for update
  using (
    public.es_admin(auth.uid())
    or (finca = any (public.fincas_de(auth.uid())) and factura_path is null)
  )
  with check (
    public.es_admin(auth.uid())
    or finca = any (public.fincas_de(auth.uid()))
  );

create or replace function public.solo_completa_factura_canastilla()
returns trigger as $$
begin
  if public.es_admin(auth.uid()) then
    return new;
  end if;

  if old.factura_path is not null then
    raise exception 'Solo un administrador puede modificar una venta que ya tiene factura.';
  end if;

  if new.finca <> old.finca or new.fecha <> old.fecha or new.semana <> old.semana
     or new.cantidad <> old.cantidad or new.cantidad_obsequio <> old.cantidad_obsequio
     or new.cantidad_repique <> old.cantidad_repique
     or new.notas is distinct from old.notas
     or new.user_id <> old.user_id then
    raise exception 'Un operario solo puede adjuntar la factura pendiente, no modificar la venta.';
  end if;

  if new.factura_path is null then
    raise exception 'Debes adjuntar una factura.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_solo_completa_factura_canastilla on public.ventas_canastillas;
create trigger trg_solo_completa_factura_canastilla
  before update on public.ventas_canastillas
  for each row execute function public.solo_completa_factura_canastilla();
