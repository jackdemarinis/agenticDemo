import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0'
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['frontend-production-6cb1.up.railway.app', '.railway.app', 'www.draftsmith.it.com', 'draftsmith.it.com']
  }
})
