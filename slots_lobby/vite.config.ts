import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
const lobbyProxy = { '/api/lobby': { target: 'http://127.0.0.1:8081', changeOrigin: true }, '/api/agent': {target: 'http://127.0.0.1:8081',changeOrigin: true}, '/api/vip': { target: 'http://127.0.0.1:8081', changeOrigin: true }, '/api/activity': { target: 'http://127.0.0.1:8081', changeOrigin: true }, '/api/recharge': { target: 'http://127.0.0.1:8081', changeOrigin: true }, '/api/game': { target: 'http://127.0.0.1:8081', changeOrigin: true }, '/api/user': { target: 'http://127.0.0.1:8081', changeOrigin: true } };
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { proxy: lobbyProxy },
  preview: { proxy: lobbyProxy },
  // 测试与开发优化缓存隔离，避免并行检查后浏览器拿到失效依赖。
  cacheDir: mode === 'test' ? 'node_modules/.vite-tests' : 'node_modules/.vite',
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\//, priority: 20 },
    { name: 'ui', test: /node_modules\/(antd|@ant-design|@rc-component)\//, priority: 10 },
  ] } } } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], clearMocks: true },
}));
