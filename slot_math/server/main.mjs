import { createServer } from 'node:http';
import path from 'node:path';
import { createFileMiddleware } from './stores.ts';
import { createHandler } from './http.mjs';

const dataRoot = path.resolve(process.env.MATH_DATA_ROOT || './data');
const middleware = createFileMiddleware(path.join(dataRoot, 'game_configs'), path.join(dataRoot, 'game_libraries'), { allowRemote: true });
const server = createServer(createHandler({ middleware, staticRoot: process.env.MATH_STATIC_ROOT || './dist' }));
server.requestTimeout = 120_000;
server.headersTimeout = 15_000;
server.listen(Number(process.env.PORT || 8090), process.env.HOST || '127.0.0.1', () => console.log('Math service ready.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
});
