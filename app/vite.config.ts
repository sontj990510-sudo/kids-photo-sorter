import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function resolveBasePath() {
  const configuredBasePath = process.env.VITE_BASE_PATH

  if (configuredBasePath) {
    const pathWithLeadingSlash = configuredBasePath.startsWith('/')
      ? configuredBasePath
      : `/${configuredBasePath}`

    return pathWithLeadingSlash.endsWith('/')
      ? pathWithLeadingSlash
      : `${pathWithLeadingSlash}/`
  }

  if (!process.env.GITHUB_ACTIONS) {
    return '/'
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').pop()
  return repositoryName ? `/${repositoryName}/` : '/kids-photo-sorter/'
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBasePath(),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Giving Tree Photo Garden',
        short_name: 'Giving Tree',
        description: '아이 사진을 기기 안에서 안전하게 분류하고 공유하는 도구',
        theme_color: '#285d46',
        background_color: '#f7f8ef',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        lang: 'ko',
        categories: ['photo', 'productivity'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/cdn\.jsdelivr\.net\/npm\/@vladmandic\/human@3\.3\.6\/models\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'giving-tree-face-models',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
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
})
