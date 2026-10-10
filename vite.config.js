import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      // Una versión nueva del service worker se activa sola en la siguiente
      // carga, sin dejar la app en una versión vieja para siempre.
      registerType: 'autoUpdate',
      // `vite-plugin-pwa` inyecta el registro por su cuenta: no hace falta
      // importar nada en el código de la aplicación.
      injectRegister: 'auto',

      // Assets de `public/` que el precache ignora por extensión.
      includeAssets: ['favicon.svg', 'favicon.ico', 'langbox.svg', 'og-image.png'],

      manifest: {
        id: '/',
        name: 'LangBox - Tu repositorio de vocabulario',
        short_name: 'LangBox',
        description:
          'Guarda, organiza y practica tu vocabulario en inglés. Funciona sin conexión.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        background_color: '#09090b',
        theme_color: '#09090b',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png', purpose: 'any' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // La zona segura de una maskable es un círculo del 80%; Android la
          // recorta en círculo, en cuadrado redondeado o en gota según el launcher.
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Mi vocabulario',
            short_name: 'Vocabulario',
            url: '/vocabulary',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Practicar tarjetas',
            short_name: 'Tarjetas',
            url: '/flashcards',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },

      workbox: {
        // Se precachea todo el build, incluida la fuente: sin esto la app
        // arrancaría offline con la tipografía del sistema.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,ttf,woff,woff2}'],

        // La app usa `createWebHistory`, así que `/vocabulary`, `/flashcards` o
        // cualquier ruta profunda son documentos distintos. Sin este fallback,
        // recargar cualquiera de ellas sin conexión daría un 404.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        // El service worker solo sirve requests de su propio origen, y las peticiones a
        // Supabase, Gemini, Groq y OpenRouter salen del código con `fetch` (destination ''). No se
        // cachean aquí a propósito: su resultado lo decide `networkStore` y la
        // cola de pendientes de `syncService`.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'langbox-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Incluye la foto de perfil de Google, para que el encabezado se vea
            // igual al perder la conexión.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'langbox-images',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },

      // El service worker en desarrollo cachea el código viejo y rompe el HMR.
      // Para probar el modo offline: `npm run build && npm run preview`.
      devOptions: { enabled: false }
    })
  ]
})