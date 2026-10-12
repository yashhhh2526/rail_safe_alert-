import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Sync build output to root dist directory for Vercel deployment
function syncToRootDist() {
  return {
    name: 'sync-to-root-dist',
    closeBundle() {
      try {
        const srcDir = path.resolve(__dirname, 'dist')
        const destDir = path.resolve(__dirname, '../dist')
        if (fs.existsSync(srcDir)) {
          fs.cpSync(srcDir, destDir, { recursive: true, force: true })
        }
      } catch (err) {
        console.warn('Notice syncing build to root dist:', err.message)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), syncToRootDist()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
