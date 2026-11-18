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
for name in ('compose.yaml', 'Dockerfile.service', '.dockerignore', 'nginx.conf', '.env.example', 'backup.sh', 'renew-certificate.sh', 'enable-https.py', 'README.md'):
    shutil.copy2(repo / 'deploy/test' / name, out / name)
payload = out / 'payload'
payload.mkdir()
# Full releases must retain the deployed math service; never silently drop it.
math_dist = repo / 'slot_math/dist'
math_server = repo / 'slot_math/dist-server'
if not math_dist.is_dir() or not math_server.is_dir():
    raise SystemExit('Build slot_math first: npm run build:deploy')
for name in ('Dockerfile.math', 'compose.math.yaml'):
    shutil.copy2(repo / 'deploy/test' / name, out / name)
shutil.copytree(math_dist, payload / 'math/dist')
shutil.copytree(math_server, payload / 'math/dist-server')
shutil.copytree(repo / 'lobby_service/etc', payload / 'lobby-etc')
games_path = payload / 'lobby-etc/games.json'
games = json.loads(games_path.read_text())
projects = ('mahjongway', 'mahjongway2', 'showdown', 'fortunetiger',
            'fortunerabbit', 'fortunemouse', 'fortuneox', 'fortunedragon', 'fortuneleopard', 'fortunechinchilla')
game_paths = {f'AG{i}': project for i, project in enumerate(projects, start=1)}
for name in game_paths:
    path = name.lower()
    game = games['games'][name]
    game['url'] = origin + '/games/' + path + '/'
    game['apiUrl'] = 'http://game:8080'
games_path.write_text(json.dumps(games, ensure_ascii=False, indent=2) + '\n')
invite_path = payload / 'lobby-etc/invite.json'
invite = json.loads(invite_path.read_text())
invite['baseUrl'] = origin + '/'
invite_path.write_text(json.dumps(invite, ensure_ascii=False, indent=2) + '\n')
shutil.copytree(repo / 'slots_lobby/dist', payload / 'www')
shutil.copytree(repo / 'slots_lobby_admin/dist', payload / 'www/ops')
for game, project in game_paths.items():
    shutil.copytree(repo / 'client' / project / 'build/web-mobile', payload / 'www/games' / game.lower())
shutil.copytree(repo / 'game_libraries/AG1', payload / 'game-libraries/AG1')
shutil.copytree(repo / 'game_libraries/AG2', payload / 'game-libraries/AG2')
shutil.copytree(repo / 'game_libraries/AG3', payload / 'game-libraries/AG3')
deployments = repo / 'slots_service/testdata/deployments'
for version in sorted(deployments.iterdir()):
    if not version.is_dir():
        continue
    for game in game_paths.keys() & {path.name for path in version.iterdir() if path.is_dir()}:
        shutil.copytree(version / game, payload / 'game-data/deployments' / version.name / game)
shutil.copytree(repo / 'slots_service/testdata/integration/AG1', payload / 'game-data/integration/AG1')
configs = payload / 'game-configs'
configs.mkdir()
config = json.loads((repo / 'slots_service/configs/server.lobby.json').read_text())
if set(config['lobby']['gameIds']) != set(game_paths):
    raise SystemExit('lobby gameIds must match the published game clients')
config['http']['address'] = '0.0.0.0:8080'
config['allowedOrigins'] = [origin]
config['lobby']['url'] = 'http://lobby:8081'
(configs / 'server.test-cloud.json').write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
policies = json.loads((repo / 'slots_service/configs/bets.test.json').read_text())
(configs / 'bets.test.json').write_text(json.dumps(
    [row for row in policies if row['gameId'] in game_paths], ensure_ascii=False, indent=2) + '\n')
(payload / 'bin').mkdir()
# Runtime containers use a non-root UID, while a validated AG4 snapshot may
# retain the private directory mode of the publisher's temporary directory.
for path in payload.rglob('*'):
    path.chmod(path.stat().st_mode | (0o055 if path.is_dir() else 0o044))
print(out)
