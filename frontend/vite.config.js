import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Explicit (redundant with autoUpdate's own defaults, kept for clarity): a new
      // service worker activates immediately rather than waiting for every open tab
      // to close, so a deployed fix reaches users on their next navigation instead of
      // being stuck behind a stale cached bundle indefinitely.
      // maximumFileSizeToCacheInBytes: the default 2 MiB cap started rejecting the
      // main bundle once Tiptap's rich-text editor was added (~2.3 MiB) — raised
      // just enough to cover it rather than leaving the whole bundle uncached.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Without this, the auto-registered SPA NavigationRoute intercepts EVERY
        // same-origin navigation (window.open, typed URL, iframe load) once the
        // service worker is active — including requests for real static files like
        // citizen-charter.pdf — and answers with the cached index.html instead of
        // letting the actual file load. That made "Open in New Tab" for the
        // Citizen's Charter silently render the SPA shell (which falls through to
        // the homepage route) instead of the PDF.
        navigateFallbackDenylist: [/^\/citizen-charter\.pdf$/],
      },
      includeAssets: ['peso-logo.png'],
      manifest: {
        name: 'JobBridge — PESO Pila, Laguna',
        short_name: 'JobBridge',
        description: 'Intelligent Job Matching & Employment Monitoring System',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/peso-logo.png', sizes: '150x150', type: 'image/png' },
          { src: '/peso-logo.png', sizes: '630x630', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})
