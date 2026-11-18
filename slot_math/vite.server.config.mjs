import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    ssr: 'server/main.mjs',
    target: 'node22',
    outDir: 'dist-server',
    rollupOptions: { output: { entryFileNames: 'server.mjs' } },
  },
});
