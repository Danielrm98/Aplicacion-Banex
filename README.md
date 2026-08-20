# ApproBan

App web para registrar la producción diaria de cajas de banano: alta de registros, historial con filtros y edición, y un dashboard de reportes con exportación a Excel/PDF.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (Postgres + Auth) como backend
- recharts, exceljs, jsPDF

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com), crea una cuenta gratuita y un proyecto nuevo.
2. En el panel del proyecto, ve a **SQL Editor**, pega el contenido de [supabase/schema.sql](supabase/schema.sql) y ejecútalo. Esto crea la tabla `producciones` con seguridad a nivel de fila (cada usuario solo ve sus propios registros).
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**

## 2. Configurar variables de entorno

Copia el archivo de ejemplo y completa los valores del paso anterior:

```bash
cp .env.local.example .env.local
```

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

`.env.local` no se sube al repositorio (ver `.gitignore`).

## 3. Instalar y correr

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. La primera vez, usa "¿No tienes cuenta? Crear una" para registrar tu usuario (según la configuración de tu proyecto Supabase, puede pedirte confirmar el correo antes de poder iniciar sesión).

## Estructura

- `src/pages` — pantallas: Login, Registrar (alta), Historial, Reportes.
- `src/components` — formulario, tabla, filtros, gráficos, exportación.
- `src/lib` — cliente Supabase, contexto de autenticación, hooks de datos, agregaciones y exportación.
- `supabase/schema.sql` — esquema de base de datos y políticas de seguridad (RLS).

## Build de producción

```bash
npm run build
npm run preview
```
