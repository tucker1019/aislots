import { createTigerLibraryStore } from './server/tiger-library.mjs';
import { validateTigerSkeletonLibrary, tigerCoverage } from './src/domain/tigerSkeleton';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createPaylineStore, createBoardStore, createGameMiddleware, createGameStore } from './server/game-files.mjs';
import { validateGameFiles } from './src/domain/settings';
import { createLibraryStore } from './server/board-library.mjs';
import { auditLibrary, validateLibrary } from './src/domain/boardLibrary';
import { validateBoardFile } from './src/domain/board';

import { validatePaylines } from './src/domain/paylines';

const root = fileURLToPath(new URL('../game_configs/', import.meta.url));
const boardStore = createBoardStore(root, validateBoardFile);
const libraryRoot = fileURLToPath(new URL('../game_libraries/', import.meta.url));
const gameStore = createGameStore(root, validateGameFiles);
const libraryStore = createLibraryStore(libraryRoot, boardStore, validateLibrary, async (gameId, value, current) => {
  const document = await gameStore.read(gameId);
  return auditLibrary(value, { ...current.file, lineCount: 1 }, document.files[value.options.mode as 'base' | 'free']);
});
const paylineStore = createPaylineStore(root, validatePaylines);
const tigerLibraryStore = createTigerLibraryStore(libraryRoot, paylineStore, gameStore, validateTigerSkeletonLibrary, tigerCoverage);
const middleware = createGameMiddleware(gameStore, boardStore, libraryStore, paylineStore, tigerLibraryStore);
export default defineConfig({
  base: './',
  plugins: [{
    name: 'local-game-files',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  }],
});
