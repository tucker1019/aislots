import {createDragonLibraryStore} from './server/dragon-library.mjs';
import {validateDragonConfig,validateDragonLibrary,dragonCoverage} from './src/domain/fortuneDragon';
import {createOxLibraryStore} from './server/ox-library.mjs';
import {validateOxConfig,validateOxLibrary,oxCoverage} from './src/domain/fortuneOx';
import { createTigerLibraryStore } from './server/tiger-library.mjs';
import { createRabbitLibraryStore } from './server/rabbit-library.mjs';
import {createMouseLibraryStore} from './server/mouse-library.mjs';
import {validateMouseConfig,validateMouseLibrary,mouseCoverage} from './src/domain/fortuneMouse';
import { validateRabbitConfig, validateRabbitLibrary, rabbitCoverage } from './src/domain/fortuneRabbit';
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
const paylineStore = createPaylineStore(root, value => value?.ruleType==='fortune_dragon_v1'?validateDragonConfig(value):value?.ruleType==='fortune_ox_v1'?validateOxConfig(value):value?.ruleType==='fortune_mouse_v1'?validateMouseConfig(value):value?.ruleType==='fortune_rabbit_v1'?validateRabbitConfig(value):validatePaylines(value));
const tigerLibraryStore = createTigerLibraryStore(libraryRoot, paylineStore, gameStore, validateTigerSkeletonLibrary, tigerCoverage);
const rabbitLibraryStore = createRabbitLibraryStore(libraryRoot,paylineStore,gameStore,validateRabbitLibrary,rabbitCoverage);
const mouseLibraryStore=createMouseLibraryStore(libraryRoot,paylineStore,gameStore,validateMouseLibrary,mouseCoverage);
const dragonLibraryStore=createDragonLibraryStore(libraryRoot,paylineStore,gameStore,validateDragonLibrary,dragonCoverage);
const oxLibraryStore=createOxLibraryStore(libraryRoot,paylineStore,gameStore,validateOxLibrary,oxCoverage);
const paylineLibraryStore={async save(gameId,revision,value){return (value?.format==='dragon-skeleton-v1'?dragonLibraryStore:value?.format==='ox-skeleton-v1'?oxLibraryStore:value?.format==='mouse-skeleton-v1'?mouseLibraryStore:value?.format==='rabbit-skeleton-v1'?rabbitLibraryStore:tigerLibraryStore).save(gameId,revision,value);}};
const middleware = createGameMiddleware(gameStore, boardStore, libraryStore, paylineStore, paylineLibraryStore);
export default defineConfig({
  base: './',
  plugins: [{
    name: 'local-game-files',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  }],
});
