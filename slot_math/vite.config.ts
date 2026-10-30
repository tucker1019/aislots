import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createBoardStore, createGameMiddleware, createGameStore } from './server/game-files.mjs';
import { validateGameFiles } from './src/domain/settings';
import { createLibraryStore } from './server/board-library.mjs';
import { validateLibrary } from './src/domain/boardLibrary';
import { validateBoardFile } from './src/domain/board';

const root = fileURLToPath(new URL('../game_configs/', import.meta.url));
const boardStore = createBoardStore(root, validateBoardFile);
const libraryRoot = fileURLToPath(new URL('../game_libraries/', import.meta.url));
const middleware = createGameMiddleware(createGameStore(root, validateGameFiles), boardStore, createLibraryStore(libraryRoot, boardStore, validateLibrary));
export default defineConfig({
  base: './',
  plugins: [{
    name: 'local-game-files',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  }],
});
