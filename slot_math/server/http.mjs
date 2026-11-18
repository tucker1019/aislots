import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

export function createHandler({ middleware, staticRoot }) {
  const root = path.resolve(staticRoot);
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/healthz' && req.method === 'GET') { res.end('OK\n'); return; }
    try {
      await middleware(req, res, async () => {
        try {
          if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
          const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
          const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
          if (!file.startsWith(root + path.sep) || pathname.includes('\0') || pathname.includes('\\')) {
            res.writeHead(404); res.end(); return;
          }
          const info = await stat(file);
          if (!info.isFile()) { res.writeHead(404); res.end(); return; }
          res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
          res.setHeader('Content-Length', info.size);
          res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'private, max-age=2592000, immutable' : 'no-cache');
          if (req.method === 'HEAD') { res.end(); return; }
          createReadStream(file).on('error', () => res.destroy()).pipe(res);
        } catch (error) {
          if (res.headersSent) { res.destroy(); return; }
          res.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof URIError ? 404 : 500);
          res.end('File unavailable.');
        }
      });
    } catch {
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(500); res.end('Service unavailable.');
    }
  };
}
