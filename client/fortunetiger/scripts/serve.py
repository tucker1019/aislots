"""Serve the locally built AG4 client."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=5184)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'build/web-mobile'
if not (root / 'index.html').is_file():
    parser.error('build AG4 first (npm run build)')
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(root)))
print(f'AG4: http://127.0.0.1:{args.port}/', flush=True)
server.serve_forever()
