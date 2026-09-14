// Se agrega al service worker generado (ver vite.config.ts,
// workbox.importScripts) para poder mostrar notificaciones push, algo que
// vite-plugin-pwa no genera solo. No pasa por Vite/Workbox: es JS plano tal
// cual lo carga el navegador dentro del service worker.

self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch {
    datos = { title: 'ApproBan', body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(datos.title || 'ApproBan', {
      body: datos.body || '',
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      data: { url: datos.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaClientes) => {
      for (const cliente of listaClientes) {
        if ('focus' in cliente) return cliente.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
