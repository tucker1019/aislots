import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createFileMiddleware } from './server/stores';

const middleware = createFileMiddleware(
  fileURLToPath(new URL('../game_configs/', import.meta.url)),
  fileURLToPath(new URL('../game_libraries/', import.meta.url)),
);
export default defineConfig({
  base: './',
  plugins: [{
    name: 'local-game-files',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  }],
});
