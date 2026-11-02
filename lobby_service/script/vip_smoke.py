"""VIP HTTP smoke against bundled screenshot config; creates a test visitor and recharge."""
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

base = os.environ.get('LOBBY_SMOKE_URL', 'http://127.0.0.1:8081')

def call(path, data=None, expected=200):
    req = urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    body = json.load(response)
    assert response.status == expected, (response.status, body)
    assert response.headers['X-Trace-Id']
    return body.get('data', body)

visitor = call('/api/user/account/visitor/login', {})
identity = {k: visitor[k] for k in ('uid', 'sid')}
query = urllib.parse.urlencode(identity)
info = call('/api/vip/info?' + query)
assert len(info['levels']) == 31
assert info['levels'][1]['upgradeBet'] == 100
assert info['levels'][2]['upgradeBet'] == 300000
assert info['levels'][24]['monthlyReward'] == 277600
assert info['levels'][30]['upgradeBet'] == 100000000000
assert info['state']['level'] == info['state']['highestLevel'] == 0
assert info['state']['upgradeRecharge'] == 0
assert info['upgradeRewards'] == [] and info['upgradeClaimableTotal'] == 0
assert info['weeklyPreview']['status'] == info['monthlyPreview']['status'] == 'preview'
for kind in ('upgrade', 'weekly', 'monthly'):
    body = dict(identity, requestId=secrets.token_hex(12), activityDate=info['activityDate'])
    error = call(f'/api/vip/{kind}/claim', body, 400)
    assert error['code'] == 10010016
    call(f'/api/vip/{kind}/claim', dict(body, requestId=''), 400)
    call(f'/api/vip/{kind}/claim', dict(body, activityDate='2000-01-01'), 409)
call('/api/vip/info?uid=1&sid=bad', expected=401)
# Pending recharge must not add VIP progress; successful recharge must add exactly once.
body = dict(identity, tierId='recharge_10', requestId=secrets.token_hex(12))
order = call('/api/recharge/create', body)
assert order['status'] == 'pending'
assert call('/api/vip/info?' + query)['state']['upgradeRecharge'] == 0
end = time.monotonic() + 8
while True:
    detail = call('/api/recharge/order/info?' + query + '&orderId=' + order['orderId'])
    if detail['status'] == 'success':
        break
    assert time.monotonic() < end, detail
    time.sleep(0.2)
assert call('/api/vip/info?' + query)['state']['upgradeRecharge'] == 1000
call('/api/recharge/create', body)
assert call('/api/vip/info?' + query)['state']['upgradeRecharge'] == 1000
assert call('/api/user/user/info?' + query)['coins'] == 980
print('VIP HTTP smoke passed: 31 picture levels in cents, auth, claims, pending/successful recharge and exactly-once VIP progress.')
