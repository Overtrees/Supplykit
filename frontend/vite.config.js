import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    target: 'es2020'
  },
  esbuild: {
    minifyIdentifiers: false,
    minifySyntax: true
  },
  server: { port: 5173 },
})