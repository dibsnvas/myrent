import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the React app calls /api/... on its own origin and Vite forwards it to Django.
// In production VITE_API_URL points at the Render backend instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Override with MYRENT_API=http://127.0.0.1:8010 if port 8000 is busy.
      '/api': process.env.MYRENT_API ?? 'http://127.0.0.1:8000',
    },
  },
})
