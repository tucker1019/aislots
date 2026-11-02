"""Exercise all five endpoints against a running lobby; creates isolated smoke accounts."""
import json
import os
import secrets
import urllib.error
import urllib.request

base = os.environ.get('LOBBY_SMOKE_URL', 'http://127.0.0.1:8081')

def call(path, data, expected=200):
    request = urllib.request.Request(base + '/api/user/account/' + path,
        data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    body = json.load(response)
    assert response.code == expected, (path, response.code, body)
    return body.get('data', body)

account = 'smoke_' + secrets.token_hex(8)
visitor = call('visitor/login', {})
identity = {key: visitor[key] for key in ('uid', 'sid')}
renewed = call('session/renewal', identity)
assert renewed['sid'] == visitor['sid']
bound = call('uniquecode/bind', dict(identity, account=account, password='password-123'))
assert bound['uid'] == visitor['uid']
call('uniquecode/bind', dict(identity, account=account + '_other', password='password-123'), 409)
call('uniquecode/login', dict(identity, account=account, password='incorrect'), 401)
other = call('uniquecode/register', dict(account=account + '_registered', password='password-456'))
call('uniquecode/register', dict(account=account, password='password-123'), 409)
logged = call('uniquecode/login', dict(identity, account=account + '_registered', password='password-456'))
assert logged['uid'] == other['uid'] and logged['sid'] != visitor['sid']
call('session/renewal', dict(uid=other['uid'], sid=visitor['sid']), 401)
call('session/renewal?uid=0', identity, 400)
assert isinstance(logged['uid'], int) and 'expiresAt' in logged
print('PostgreSQL + HTTP smoke passed: five endpoints, account switching, duplicates, invalid sessions, identity mismatch.')
