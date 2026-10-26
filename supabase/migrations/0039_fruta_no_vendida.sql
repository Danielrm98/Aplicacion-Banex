-- "Fruta no vendida": igual que canastillas (unidades a 19kg cada una), pero
-- por un motivo aparte. Su peso también se suma al de canastillas para que
-- el peso neto de racimo y el % de merma reflejen toda la fruta que no
-- terminó en cajas, no solo la que se fue por canastillas.
alter table public.producciones
  add column fruta_no_vendida integer not null default 0 check (fruta_no_vendida >= 0);
