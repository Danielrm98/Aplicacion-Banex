-- Los defectos de "Perfil de racimos" se registran en peso (decimales),
-- no en cantidad entera, pero la columna se quedó como integer desde la
-- migración original. Al guardar un defecto con decimales (por ejemplo
-- 0.35), el insert fallaba entero -- la evaluación y las muestras ya
-- habían quedado guardadas en un paso anterior, pero ningún defecto se
-- alcanzaba a guardar, por eso "Ranking de defectos" siempre aparecía
-- vacío aunque sí se hubieran registrado.
alter table public.perfil_racimo_defectos
  alter column cantidad type numeric using cantidad::numeric;
