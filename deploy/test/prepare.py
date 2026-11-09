#!/usr/bin/env python3
"""Assemble previously built artifacts; no local account data or secrets are copied."""
import argparse
import json
import shutil
from pathlib import Path
from urllib.parse import urlparse

repo = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--origin', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
u = urlparse(args.origin)
if u.scheme not in ('http', 'https') or not u.netloc or u.username or u.password or u.path not in ('', '/') or u.query or u.fragment:
    raise SystemExit('origin must be an HTTP(S) origin without credentials/path/query')
origin = args.origin.rstrip('/')
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=False)
for name in ('compose.yaml', 'Dockerfile.service', 'nginx.conf', '.env.example', 'backup.sh', 'renew-certificate.sh', 'enable-https.py', 'README.md'):
    shutil.copy2(repo / 'deploy/test' / name, out / name)
payload = out / 'payload'
payload.mkdir()
shutil.copytree(repo / 'lobby_service/etc', payload / 'lobby-etc')
games_path = payload / 'lobby-etc/games.json'
games = json.loads(games_path.read_text())
for name, game in games['games'].items():
    if name != 'AG1':
        game['enabled'] = False
    else:
        game['url'] = origin + '/games/ag1/'
        game['apiUrl'] = 'http://game:8080'
games_path.write_text(json.dumps(games, ensure_ascii=False, indent=2) + '\n')
invite_path = payload / 'lobby-etc/invite.json'
invite = json.loads(invite_path.read_text())
invite['baseUrl'] = origin + '/'
invite_path.write_text(json.dumps(invite, ensure_ascii=False, indent=2) + '\n')
shutil.copytree(repo / 'slots_lobby/dist', payload / 'www')
shutil.copytree(repo / 'slots_lobby_admin/dist', payload / 'www/ops')
shutil.copytree(repo / 'client/mahjongway/build/web-mobile', payload / 'www/games/ag1')
shutil.copytree(repo / 'game_libraries/AG1', payload / 'game-libraries/AG1')
shutil.copytree(repo / 'slots_service/testdata/deployments', payload / 'game-data/deployments')
shutil.copytree(repo / 'slots_service/testdata/integration/AG1', payload / 'game-data/integration/AG1')
configs = payload / 'game-configs'
configs.mkdir()
config = json.loads((repo / 'slots_service/configs/server.lobby.json').read_text())
config['http']['address'] = '0.0.0.0:8080'
config['allowedOrigins'] = [origin]
config['lobby']['url'] = 'http://lobby:8081'
(configs / 'server.test-cloud.json').write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
shutil.copy2(repo / 'slots_service/configs/bets.test.json', configs)
(payload / 'bin').mkdir()
print(out)
