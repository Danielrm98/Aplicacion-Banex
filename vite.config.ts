import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['banex-logo.jpg'],
      manifest: {
        name: 'ApproBan',
        short_name: 'ApproBan',
        description: 'Registro de producción de cajas de banano — BANEX S.A.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        theme_color: '#07451e',
        background_color: '#eef4ef',
        icons: [
          { src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Sin runtimeCaching: solo se cachea el "cascarón" de la app (JS/CSS/
      // HTML/íconos). Las llamadas a Supabase son a otro dominio y nunca se
      // sirven desde caché — los datos de producción siempre vienen en vivo.
      workbox: {
        // El bundle principal supera el límite por defecto de Workbox (2 MiB).
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
})
