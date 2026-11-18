import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies the API and Socket.IO to the backend, so the staff HttpOnly session
// cookie is same-origin in development. The backend's CORS_ALLOWED_ORIGINS must include this origin.
export default defineConfig(({ mode }) => {
  const environmentValues = loadEnv(mode, process.cwd(), '')
  const backendOrigin = environmentValues.VITE_BACKEND_ORIGIN || 'http://localhost:4000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backendOrigin, changeOrigin: true },
        '/socket.io': { target: backendOrigin, changeOrigin: true, ws: true },
      },
    },
  }
})
