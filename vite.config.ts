import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Increase warning threshold (manual chunks handle this)
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    // Rolldown (Vite 8) requires manualChunks as a function, not an object
    rolldownOptions: {
      output: {
        // Return a chunk name for each module ID, or undefined to let Rolldown decide
        manualChunks(id: string): string | undefined {
          // Core React runtime — tiny, cached forever, almost never changes
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // Framer Motion — only needed after splash screen exits
          if (id.includes('/node_modules/framer-motion/')) {
            return 'vendor-framer';
          }
          // Leaflet / react-leaflet — only needed on map dashboard views
          if (id.includes('/node_modules/leaflet/') || id.includes('/node_modules/react-leaflet/')) {
            return 'vendor-maps';
          }
          // Supabase client — only needed after user authenticates
          if (id.includes('/node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // Lucide icons — needed across all views but can be loaded separately
          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          return undefined;
        },
      },
    },
    // Target Safari 14+ — removes many legacy polyfills, shrinks bundle
    target: ['es2020', 'safari14'],
    // Vite 8 uses oxc transformer natively (esbuild is now a separate package)
    minify: 'oxc',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion'],
  },
})
