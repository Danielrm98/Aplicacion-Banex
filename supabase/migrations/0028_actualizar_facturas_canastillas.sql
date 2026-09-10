-- Falta el permiso de actualizar (sobrescribir) una foto de factura ya
-- subida. Se necesita para que la cola de sincronización sin conexión de
-- "Venta de canastillas" pueda reintentar una subida con el mismo nombre de
-- archivo tras un corte de conexión a medio subir, sin que falle por
-- "el archivo ya existe".
create policy "Actualizar facturas de canastillas según rol"
  on storage.objects for update
  using (
    bucket_id = 'facturas-canastillas'
    and (public.es_admin(auth.uid()) or (storage.foldername(name))[1] = any (public.fincas_de(auth.uid())))
  )
  with check (
    bucket_id = 'facturas-canastillas'
    and (public.es_admin(auth.uid()) or (storage.foldername(name))[1] = any (public.fincas_de(auth.uid())))
  );
