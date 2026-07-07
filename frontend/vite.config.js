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
      workbox: { skipWaiting: true, clientsClaim: true },
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
