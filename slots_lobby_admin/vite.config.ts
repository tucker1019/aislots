import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({
 plugins: [react()],
 cacheDir: '.vite',
 server: { proxy: { '/admin/api': { target: loadEnv(mode, '.', 'ADMIN_').ADMIN_API_TARGET || 'http://127.0.0.1:8082', changeOrigin: true },
  '/api/game/launch': { target: loadEnv(mode, '.', 'ADMIN_').ADMIN_LOBBY_API_TARGET || 'http://127.0.0.1:8081', changeOrigin: true },
 } },
 test: { environment: 'jsdom', clearMocks: true },
 build: { rolldownOptions: { output: { codeSplitting: { groups: [
  { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\//, priority: 20 },
  { name: 'ui', test: /node_modules\/(antd|@ant-design|@rc-component)\//, priority: 10 },
 ] } } } },
}));
