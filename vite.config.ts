import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The game needs no network at run time -- the engine, the generator and the
// player profile are all local -- so everything is precached and the app is
// fully playable offline after the first visit.
export default defineConfig({
  base: './',
  build: { target: 'es2022', cssCodeSplit: false },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: 'NumberDash',
        short_name: 'NumberDash',
        description: 'A two-minute mental arithmetic sprint that learns how you calculate.',
        theme_color: '#12100E',
        background_color: '#FBFAF7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
