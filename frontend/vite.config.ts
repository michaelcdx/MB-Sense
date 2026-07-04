import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

function readEnvFileValue(filePath: string, key: string) {
  if (!fs.existsSync(filePath)) return '';

  const match = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith(`${key}=`));

  return match ? match.slice(match.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '') : '';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = process.env.VITE_API_PROXY_TARGET || env.VITE_API_PROXY_TARGET || 'http://localhost:8000';
  const mapTilerApiKey =
    process.env.VITE_MAPTILER_API_KEY ||
    env.VITE_MAPTILER_API_KEY ||
    readEnvFileValue(path.resolve(__dirname, '../backend/.env'), 'VITE_MAPTILER_API_KEY');

  if (mapTilerApiKey && !process.env.VITE_MAPTILER_API_KEY) {
    process.env.VITE_MAPTILER_API_KEY = mapTilerApiKey;
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || ''),
      'import.meta.env.VITE_MAPTILER_API_KEY': JSON.stringify(mapTilerApiKey || ''),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': backendUrl,
        '/live': {
          target: backendUrl,
          ws: true,
        },
      },
    },
  };
});
