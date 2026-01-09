import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Servidor de desenvolvimento
  server: {
    port: 3000,
    open: true, // Abre browser automaticamente
    cors: true
  },

  // Production build
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Multi-page app: each HTML is an entry point
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        properties: resolve(__dirname, 'properties.html'),
        propertiesForm: resolve(__dirname, 'properties-form.html'),
        plots: resolve(__dirname, 'plots.html'),
        plotsForm: resolve(__dirname, 'plots-form.html'),
        sensors: resolve(__dirname, 'sensors.html'),
        alerts: resolve(__dirname, 'alerts.html')
      }
    },
    // Modern target (latest Edge/Chrome versions)
    target: 'esnext',
    minify: 'esbuild'
  },

  // Resolve aliases para imports mais limpos
  resolve: {
    alias: {
      '@': resolve(__dirname, 'js')
    }
  }
});
