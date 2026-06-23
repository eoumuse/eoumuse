import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/eoumuse/',
  plugins: [
    tailwindcss(),
    react(),
  ],
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        synth: resolve(__dirname, 'synth.html'),
      },
    },
  },
})
