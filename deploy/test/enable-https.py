#!/usr/bin/env python3
"""Run inside the deployed release after a trusted IP certificate has been issued."""
import argparse
import ipaddress
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--ip', required=True)
p.add_argument('--directory', type=Path, default=Path('.'))
a = p.parse_args()
ip = str(ipaddress.ip_address(a.ip))
base = a.directory.resolve()
nginx = base / 'nginx.conf'
config = nginx.read_text()
if 'listen 443 ssl;' not in config:
    config = config.replace('    listen 80;', f'''    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/{ip}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{ip}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;''', 1)
    config += '''\nserver {
    listen 80;
    server_name _;
    access_log /var/log/nginx/access.log sanitized;
    server_tokens off;
    location ^~ /.well-known/acme-challenge/ { root /srv/acme; }
    location / { return 308 https://$host$request_uri; }
}
'''
    nginx.write_text(config)
origin = 'https://' + ip
path = base / 'payload/lobby-etc/games.json'
data = json.loads(path.read_text())
data['games']['AG1']['url'] = origin + '/games/ag1/'
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
path = base / 'payload/lobby-etc/invite.json'
data = json.loads(path.read_text())
data['baseUrl'] = origin + '/'
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
path = base / 'payload/game-configs/server.test-cloud.json'
data = json.loads(path.read_text())
data['allowedOrigins'] = [origin]
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('Public origin configured:', origin)
