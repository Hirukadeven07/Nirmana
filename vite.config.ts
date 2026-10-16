import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Set by the CD pipeline so the app is served from /<repo>/ on GitHub Pages.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
})
