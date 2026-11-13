/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/trackup-logo.jpg', 'assets/icon-192x192.png', 'assets/icon-512x512.png'],
      manifest: {
        name: 'TrackUp - Entertainment & Reading Tracker',
        short_name: 'TrackUp',
        description: 'Track what you love. Hosted multi-user entertainment and reading tracker for Movies, TV Shows, Anime Series, Anime Films, Manga, and Manhwa.',
        theme_color: '#FFC400',
        background_color: '#101014',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/assets/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/assets/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/assets/trackup-logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        runtimeCaching: [
          {
            // Strictly NetworkOnly for Supabase API & Auth to prevent session drop / stale progress
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Strictly NetworkOnly for AniList GraphQL endpoint
            urlPattern: /^https:\/\/graphql\.anilist\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // CacheFirst for external media posters (TMDB & AniList) with 30-day expiration
            urlPattern: /^https:\/\/(image\.tmdb\.org|s4\.anilist\.co)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-posters-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // StaleWhileRevalidate for static typography / font assets
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 25000,
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
  },
});
