import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg'],
      manifest: {
        name: 'JobBridge — PESO Pila, Laguna',
        short_name: 'JobBridge',
        description: 'Intelligent Job Matching & Employment Monitoring System',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [{ src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})
