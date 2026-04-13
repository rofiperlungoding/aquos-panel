import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('recharts') || id.includes('d3') || id.includes('recharts')) return 'charts';
            if (id.includes('xterm')) return 'terminal';
            if (id.includes('react')) return 'vendor';
            return 'modules';
          }
        }
      }
    }
  }
})
