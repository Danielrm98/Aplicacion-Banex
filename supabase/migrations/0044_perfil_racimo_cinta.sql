-- Separa el color de cinta del racimo (desplegable, mismas 8 cintas que ya
-- maneja Embolses) de la edad, que antes compartían una sola casilla de
-- texto libre.
alter table public.perfil_racimo_muestras
  add column if not exists cinta text check (cinta is null or cinta in ('BLANCA', 'AZUL', 'ROJA', 'CAFE', 'NEGRA', 'NARANJA', 'VERDE', 'AMARILLA'));
