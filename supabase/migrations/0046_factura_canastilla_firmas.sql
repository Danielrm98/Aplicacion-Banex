-- La factura de canastillas ahora también se puede generar dentro de la
-- app (en vez de solo subir una foto de un papel): se guarda quién entrega
-- y quién recibe, para que quede plasmado junto a las firmas digitales en
-- la imagen generada. No se necesita tocar el trigger
-- solo_completa_factura_canastilla: estas dos columnas no están en su lista
-- de campos protegidos, así que un operario ya puede escribirlas al mismo
-- tiempo que completa factura_path, igual que hoy.
alter table public.ventas_canastillas
  add column if not exists entregado_por text,
  add column if not exists recibido_por text;
