import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  plugins: [
    // Tell the React plugin to handle JSX inside .js files (dev server)
    react({
      include: '**/*.{js,jsx,ts,tsx}',
    }),
    tailwindcss(),
  ],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
    // Strip debug logging from production builds (console.error/warn kept).
    ...(command === 'build' ? { pure: ['console.log', 'console.info', 'console.debug'] } : {}),
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
}));
