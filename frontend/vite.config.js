import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_DEV_BACKEND_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // In development the browser talks to Vite; /api is forwarded to FastAPI
      // (media are served through access-checked /api endpoints, not a public folder).
      proxy: {
        '/api': { target: backend, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router'],
            charts: ['recharts'],
            map: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.js'],
    },
  }
})
