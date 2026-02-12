import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  // Base path configuration:
  // - Development (npm run dev): './' (root, works with localhost:3000)
  // - Production (npm run build): '/agro/' (Kubernetes path-based routing)
  // - Override via VITE_BASE_PATH env var
  base: process.env.VITE_BASE_PATH || (mode === 'production' ? '/agro/' : './'),

  // Plugins
  plugins: [],

  // Development server
  server: {
    port: 3000,
    open: true,
    cors: true,
    // Hot Module Replacement
    hmr: {
      overlay: true // Show errors in browser overlay
    }
  },

  // Production build
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false, // Disable in production for security

    // Multi-page app: each HTML is an entry point
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        properties: resolve(__dirname, 'properties.html'),
        propertiesForm: resolve(__dirname, 'properties-form.html'),
        plots: resolve(__dirname, 'plots.html'),
        plotsForm: resolve(__dirname, 'plots-form.html'),
        users: resolve(__dirname, 'users.html'),
        usersForm: resolve(__dirname, 'users-form.html'),
        sensors: resolve(__dirname, 'sensors.html'),
        alerts: resolve(__dirname, 'alerts.html')
      },
      output: {
        // Code splitting for better caching
        manualChunks: {
          vendor: ['axios', '@microsoft/signalr', 'chart.js'],
          utils: ['dayjs']
        }
      },
      // Suppress warnings
      onwarn(warning, warn) {
        // Ignore SignalR PURE comment warnings
        if (
          warning.code === 'SOURCEMAP_ERROR' ||
          (warning.code === 'PLUGIN_WARNING' && warning.message.includes('PURE'))
        ) {
          return;
        }
        warn(warning);
      }
    },

    // Modern target (latest Edge/Chrome versions)
    target: 'esnext',
    minify: 'esbuild',

    // Esbuild minification options
    esbuild: {
      drop: ['console', 'debugger'], // Remove console.log in production
      legalComments: 'none'
    },

    // Chunk size warnings
    chunkSizeWarningLimit: 1000,

    // Asset handling
    assetsInlineLimit: 4096 // Inline assets < 4kb as base64
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'axios',
      '@microsoft/signalr',
      'chart.js',
      'dayjs',
      'dayjs/plugin/relativeTime',
      'dayjs/locale/en'
    ]
  },

  // Resolve aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, 'js'),
      '@css': resolve(__dirname, 'css')
    }
  },

  // Preview server (for testing production build)
  preview: {
    port: 3001,
    open: true
  }
}));
