"""HTTP smoke against bundled newbie and recharge sample configurations."""
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

base = os.environ.get('LOBBY_SMOKE_URL', 'http://127.0.0.1:8081')


def call(path, data=None, expected=200):
    request = urllib.request.Request(
        base + path, data=None if data is None else json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    body = json.load(response)
    assert response.code == expected, (response.code, body)
    assert response.headers['X-Trace-Id']
    return body.get('data', body)


visitor = call('/api/user/account/visitor/login', {})
identity = {key: visitor[key] for key in ('uid', 'sid')}
query = urllib.parse.urlencode(identity)
info_path = '/api/activity/newbie-recharge/info?' + query
claim_path = '/api/activity/newbie-recharge/claim'
info = call(info_path)
assert info['durationDays'] == 3 and len(info['items']) == 3
assert info['rechargeAmount'] == info['claimableTotal'] == 0
assert all(item['progress'] == 0 for item in info['items'])
assert call(claim_path, dict(identity, requestId=secrets.token_hex(16)), 400)['code'] == 10010018
call('/api/activity/newbie-recharge/info?uid=1&sid=bad', expected=401)
call(claim_path, dict(identity, requestId=''), 400)
recharge_body = dict(identity, tierId='recharge_500', requestId=secrets.token_hex(16))
order = call('/api/recharge/create', recharge_body)
assert order['status'] == 'pending'
assert call(info_path)['rechargeAmount'] == 0
end = time.monotonic() + 10
while True:
    detail = call('/api/recharge/order/info?' + query + '&orderId=' + order['orderId'])
    if detail['status'] == 'success':
        break
    assert time.monotonic() < end
    time.sleep(0.2)
info = call(info_path)
assert info['rechargeAmount'] == 50000 and info['claimableTotal'] == 6000
assert [item['status'] for item in info['items']] == ['claimable', 'claimable', 'locked']
assert info['items'][2]['remaining'] == 50000
body = dict(identity, requestId=secrets.token_hex(16))
receipt = call(claim_path, body)
assert receipt['totalReward'] == 6000 and receipt['coins'] == 57000
assert len(receipt['items']) == 2
assert call(claim_path, body) == receipt
assert call(claim_path, dict(identity, requestId=secrets.token_hex(16)), 400)['code'] == 10010018
call('/api/recharge/create', recharge_body)
info = call(info_path)
assert info['rechargeAmount'] == 50000 and info['claimableTotal'] == 0
assert [item['status'] for item in info['items']] == ['claimed', 'claimed', 'locked']
assert call('/api/user/user/info?' + query)['coins'] == 57000
print('Newbie recharge HTTP smoke passed: progress, stacked manual rewards, auth, trace IDs, balance and idempotency.')
