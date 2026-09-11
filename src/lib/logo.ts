// Ruta pública fija (no un import hasheado de src/assets) a propósito: el
// service worker precachea "/banex-logo.jpg" tal cual (vite.config.ts,
// includeAssets), así que el logo siempre carga aunque el celular tenga
// señal débil o esté sin conexión. Un import hasheado desde src/assets no
// quedaba precacheado (requería red cada vez) y el logo se rompía en esos
// casos.
export const BANEX_LOGO_URL = '/banex-logo.jpg'
