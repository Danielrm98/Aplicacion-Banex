-- Las canastillas por repique son aparte de las producidas en proceso y no
-- se descuentan del acumulado disponible; solo se informa cuántas se
-- vendieron por repique, en la misma factura de la venta normal.
alter table public.ventas_canastillas
  add column cantidad_repique integer not null default 0 check (cantidad_repique >= 0);

alter table public.ventas_canastillas
  drop constraint ventas_canastillas_al_menos_una_check;

alter table public.ventas_canastillas
  add constraint ventas_canastillas_al_menos_una_check
  check (cantidad > 0 or cantidad_obsequio > 0 or cantidad_repique > 0);
