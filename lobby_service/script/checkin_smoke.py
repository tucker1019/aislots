"""Launch a temporary server with zero thresholds, creating a test visitor.
Usage: LOBBY_DATABASE_URL=... python3 script/checkin_smoke.py /path/to/lobby-binary
The main server configuration is unchanged. Uses port18081 by default.
"""
import concurrent.futures
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

port = int(os.environ.get('LOBBY_CHECKIN_SMOKE_PORT', '18081'))
base = f'http://127.0.0.1:{port}'

def call(path, body=None, expected=200):
    req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
        headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    data = json.load(response)
    assert response.status == expected, (response.status, data)
    assert response.headers['X-Trace-Id'], 'missing trace'
    return data.get('data', data)

with tempfile.TemporaryDirectory(prefix='lobby-checkin-smoke-') as directory:
    config = directory + '/checkin.json'
    with open(config, 'w') as file:
        json.dump({'version': 'checkin-smoke', 'timezone': 'Asia/Jakarta',
                   'days': [{'requiredBet': 0, 'requiredRecharge': 0, 'reward': 100}]}, file)
    env = dict(os.environ, LOBBY_HTTP_ADDRESS=f'127.0.0.1:{port}', LOBBY_CHECKIN_CONFIG=config)
    with open(directory + '/server.log', 'w+') as log:
        server = subprocess.Popen([os.path.abspath(sys.argv[1])], env=env, stdout=log, stderr=log)
        try:
            end = time.monotonic() + 8
            while True:
                try:
                    call('/health')
                    break
                except urllib.error.URLError:
                    if time.monotonic() > end or server.poll() is not None:
                        log.seek(0)
                        raise RuntimeError(log.read())
                    time.sleep(0.1)
            visitor = call('/api/user/account/visitor/login', {})
            identity = {k: visitor[k] for k in ('uid', 'sid')}
            query = urllib.parse.urlencode(identity)
            info = call('/api/activity/checkin/info?' + query)
            assert info['canClaim'] and not info['claimed'] and info['currentDay'] == 1
            body = dict(identity, activityDate=info['activityDate'])
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                receipts = list(pool.map(lambda _: call('/api/activity/checkin/claim', body), range(12)))
            assert all(r == receipts[0] for r in receipts)
            assert receipts[0]['reward'] == receipts[0]['coins'] == 100
            info = call('/api/activity/checkin/info?' + query)
            assert info['claimed'] and not info['canClaim']
            assert call('/api/user/user/info?' + query)['coins'] == 100
            call('/api/activity/checkin/claim', dict(identity, activityDate='2000-01-01'), 409)
            call('/api/activity/checkin/claim', dict(identity, activityDate='bad'), 400)
            call('/api/activity/checkin/info?uid=1&sid=bad', expected=401)
            print('Checkin HTTP smoke passed: concurrent idempotent claims, wallet, dates and authentication.')
        finally:
            server.terminate()
            server.wait(timeout=10)
