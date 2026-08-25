-- Ejecutar en el SQL Editor de tu proyecto Supabase.
-- Guarda el nombre y correo de la persona responsable de cada finca.
-- Es solo información de referencia: todavía no crea cuentas de acceso
-- ni restringe qué finca puede ver o registrar cada usuario.

alter table public.fincas
  add column if not exists responsable_nombre text,
  add column if not exists responsable_correo text;
