import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Lets "Add to Home Screen" work while running `npm run dev`, not just
      // a production build — handy for previewing without a full deploy.
      devOptions: { enabled: true },
      manifest: {
        name: 'BriteStar Scheduler',
        short_name: 'BriteStar',
        description: 'Britestar Tavern staff scheduling',
        start_url: '/',
        display: 'standalone',
        background_color: '#241d19',
        theme_color: '#241d19',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
