import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      shared: resolve(__dirname, '../shared/index.ts'),
    },
  },
  server: {
    port: 5173,
    // Proxy de WebSocket al servidor
    proxy: {
      '/socket.io': {
        target:    'http://localhost:3001',
        ws:        true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir:    'dist',
    sourcemap: true,
  },
})
