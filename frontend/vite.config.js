import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    // sourcemap 上传（有 SENTRY_AUTH_TOKEN 才生效，否则跳过）
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || '',
      project: process.env.SENTRY_PROJECT || '',
      authToken: process.env.SENTRY_AUTH_TOKEN || '',
      url: process.env.SENTRY_URL || 'https://sentry.io/',  // EU 区 org 需设 https://de.sentry.io/
      sourcemaps: { filesToDeleteAfterUpload: 'dist/assets/**/*.map' },
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    target: 'es2020'
  },
  esbuild: {
    minifyIdentifiers: false,
    minifySyntax: true
  },
  server: { port: 5173 },
})