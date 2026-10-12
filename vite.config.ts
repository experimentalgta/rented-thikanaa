import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.svg',
        'favicon.png',
        'favicon-32x32.png',
        'favicon-16x16.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
        'logo.png',
        'assets/room-bg.jpg',
      ],
      manifest: {
        id: '/?source=pwa',
        name: 'Renter Thikan',
        short_name: 'Renter Thikan',
        description: 'Find rooms, student PGs, hostels, shared accommodation, flats, and roommates.',
        theme_color: '#101828',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['lifestyle', 'utilities', 'business'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/logo.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,jpg,jpeg}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\/callback/],
        runtimeCaching: [
          // 1. WebFonts - Cache First
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 2. Public listing images in Supabase storage - Stale While Revalidate
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-public-images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 3. Public Accommodation Listings (GET only, read-only cache fallback)
          // Strictly excludes auth, user profiles, private messages, and contact requests
          {
            urlPattern: ({ url, request }) => {
              const isSupabaseRest = url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/');
              const isGet = request.method === 'GET';
              const isListing =
                url.pathname.includes('properties') ||
                url.pathname.includes('localities') ||
                url.pathname.includes('cities');
              const isPrivate =
                url.pathname.includes('messages') ||
                url.pathname.includes('conversations') ||
                url.pathname.includes('contact_requests') ||
                url.pathname.includes('auth') ||
                url.pathname.includes('profiles');

              return isSupabaseRest && isGet && isListing && !isPrivate;
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'public-listings-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 60 * 60 * 12, // 12 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
