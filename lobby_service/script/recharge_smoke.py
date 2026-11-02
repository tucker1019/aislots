"""HTTP recharge smoke: requires the bundled sample recharge configuration."""
import json
import time
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request

base = os.environ.get('LOBBY_SMOKE_URL', 'http://127.0.0.1:8081')

def call(path, data=None, expected=200):
    request = urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(),
        headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    body = json.load(response)
    assert response.code == expected, (path, response.code, body)
    return body.get('data', body)

visitor = call('/api/user/account/visitor/login', {})
identity = {key: visitor[key] for key in ('uid', 'sid')}
query = urllib.parse.urlencode(identity)
tiers = call('/api/recharge/list?' + query)['items']
assert [t['amount'] for t in tiers] == [v*100 for v in [10,20,50,100,200,300,500,1000,2000,3000,5000,10000]]
for t in tiers:
    amount = t['amount']
    assert t['fee'] == (amount*2//100 if amount <= 2000 else 0)
    assert t['bonus'] == (amount*2//100 if 20000 <= amount <= 100000 else amount*5//100 if amount >= 200000 else 0)
    assert t['creditAmount'] == amount + t['bonus'] - t['fee']
orders = []
for tier in tiers:
    body = dict(identity, tierId=tier['id'], requestId=secrets.token_hex(16))
    order = call('/api/recharge/create', body)
    assert order['status'] == 'pending' and order['paymentUrl'] == 'https://www.baidu.com'
    assert call('/api/recharge/create', body) == order
    info_url = '/api/recharge/order/info?' + query + '&orderId=' + order['orderId']
    assert call(info_url)['status'] == 'pending'
    orders.append((order, tier, info_url))
    other = next(t for t in tiers if t['id'] != tier['id'])
    call('/api/recharge/create', dict(body, tierId=other['id']), 409)
assert call('/api/user/user/info?' + query)['coins'] == 0
end = time.monotonic() + 8
while True:
    details = [call(url) for _, _, url in orders]
    if all(o['status'] == 'success' for o in details):
        break
    assert time.monotonic() < end, details
    time.sleep(0.25)
balance = sum(t['creditAmount'] for t in tiers)
assert call('/api/user/user/info?' + query)['coins'] == balance
for detail, (_, tier, _) in zip(details, orders):
    assert detail['creditAmount'] == tier['creditAmount'] and detail['settledAt']
seen = []
cursor = ''
while True:
    page = call('/api/recharge/order/list?' + query + '&limit=5&status=success&cursor=' + urllib.parse.quote(cursor))
    seen += [o['orderId'] for o in page['items']]
    cursor = page['nextCursor']
    if not cursor:
        break
assert len(seen) == len(set(seen)) == 12
assert set(seen) == {o['orderId'] for o, _, _ in orders}
assert call('/api/recharge/order/list?' + query + '&status=pending')['items'] == []
other_user = call('/api/user/account/visitor/login', {})
other_query = urllib.parse.urlencode({k: other_user[k] for k in ('uid', 'sid')})
call('/api/recharge/order/info?' + other_query + '&orderId=' + orders[0][0]['orderId'], expected=404)
call('/api/recharge/create', dict(identity, tierId='missing', requestId=secrets.token_hex(16)), 400)
call('/api/recharge/create', dict(uid=999999999, sid=identity['sid'], tierId=tiers[0]['id'], requestId='invalid'), 401)
print('HTTP recharge smoke passed: persisted pending orders, automatic settlement, 12 tiers, idempotency, balances, paginated history and ownership.')
