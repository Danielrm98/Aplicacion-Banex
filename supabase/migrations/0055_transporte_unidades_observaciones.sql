-- Cuadro de observaciones libre por unidad, para que en la finca anoten
-- novedades al momento de la llegada o la salida (ej. "llegó con una hora
-- de retraso", "faltó un sello", etc.).
alter table public.transporte_unidades
  add column observaciones text;
