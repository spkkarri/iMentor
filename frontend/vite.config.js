// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl' // <-- Import the plugin

export default defineConfig({
  plugins: [
    react(),
    basicSsl() // <-- Add the plugin here
  ],
  server: {
    port: 2002,
    https: true, // <-- Enable HTTPS
    host: true,  // <-- Make it accessible on the LAN
  },
  define: {
    'global': {},
  }
})