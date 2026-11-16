import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR se desactiva con la variable DISABLE_HMR=true.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Sin vigilancia de archivos cuando DISABLE_HMR=true.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
