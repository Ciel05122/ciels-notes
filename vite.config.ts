import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: '我的记录',
        short_name: '记录',
        description: '像朋友圈那样按时间线沉淀、像备忘录那样随手就写的私人知识库',
        lang: 'zh-CN',
        theme_color: '#faf9f5',
        background_color: '#faf9f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 缓存应用外壳，断网也能打开
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        // 云端图片/附件：缓存优先，第一次拉到后就一直用本地缓存
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kb-media',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 }, // 60 天
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
