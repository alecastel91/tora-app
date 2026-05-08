import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    // Tell the React plugin to handle JSX inside .js files (dev server)
    react({
      include: '**/*.{js,jsx,ts,tsx}',
    }),
  ],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    port: 3002,
    host: '0.0.0.0',
    // Accept any *.local hostname (mDNS) so phones can hit alessandro.local:3002
    allowedHosts: ['localhost', '.local'],
  },
});
