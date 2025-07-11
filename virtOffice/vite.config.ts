import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ 
      protocolImports: true,
      include: ['process', 'buffer', 'events', 'util', 'stream']
    }),
  ],
  define: {
    global: 'window',
    'process.env': {},
  },
  resolve: {
    alias: {
      stream: 'readable-stream',
      buffer: 'buffer',
      events: 'events',
      util: 'util',
      process: 'process/browser',
    }
  },
  optimizeDeps: {
    include: [
      'process',
      'buffer',
      'events',
      'util',
      'readable-stream'
    ]
  }
});