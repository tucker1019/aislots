"""Live HTTP agent smoke. Creates only dedicated visitors and a test recharge."""
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

base = os.environ.get('LOBBY_SMOKE_URL', 'http://127.0.0.1:8081')


def call(path, fields=None, expected=200):
    req = urllib.request.Request(base + path, data=json.dumps(fields or {}).encode(),
                                 headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    body = json.load(response)
    assert response.status == expected, (response.status, body)
    assert response.headers['X-Trace-Id']
    return body.get('data', body)


def identity(user):
    return {k: user[k] for k in ('uid', 'sid')}


root = identity(call('/api/user/account/visitor/login'))
info = call('/api/agent/info', root)
code = urllib.parse.parse_qs(urllib.parse.urlsplit(info['inviteUrl']).query)['inviteCode'][0]
child = identity(call('/api/user/account/visitor/login', {'inviteCode': code}))
child_info = call('/api/agent/info', child)
child_code = urllib.parse.parse_qs(urllib.parse.urlsplit(child_info['inviteUrl']).query)['inviteCode'][0]
grandchild = identity(call('/api/user/account/visitor/login', {'inviteCode': child_code}))
info = call('/api/agent/info', root)
assert info['summary']['teamCount'] == 2
assert info['summary']['directCount'] == info['summary']['otherCount'] == 1
assert call('/api/agent/team', root)['items'][0]['uid'] == child['uid']
assert call('/api/agent/team', dict(root, targetUid=child['uid']))['items'][0]['uid'] == grandchild['uid']
call('/api/agent/team', dict(child, targetUid=root['uid']), 400)
call('/api/agent/info', dict(root, sid='invalid'), 401)
call('/api/agent/claim', dict(root, requestId=secrets.token_hex(16)), 400)
for path in ['performance', 'performance/details', 'report', 'rates', 'records']:
    call('/api/agent/' + path, root)
for kind in ['team', 'bets', 'first-deposit', 'deposit', 'withdrawal']:
    result = call('/api/agent/report/details', dict(root, kind=kind))
    if kind == 'withdrawal':
        assert result['status'] in ['preview', 'settled']
        assert result['summary']['withdrawalCount'] == 0
        assert result['summary']['withdrawalAmount'] == 0
order = call('/api/recharge/create', dict(grandchild, tierId='recharge_10', requestId=secrets.token_hex(16)))
end = time.monotonic() + 10
while True:
    # Recharge order info uses GET; the agent API itself is POST.
    query = urllib.parse.urlencode(dict(grandchild, orderId=order['orderId']))
    with urllib.request.urlopen(base + '/api/recharge/order/info?' + query, timeout=10) as response:
        detail = json.load(response)['data']
    if detail['status'] == 'success':
        break
    assert time.monotonic() < end
    time.sleep(0.2)
report = call('/api/agent/report', root)['summary']
assert report['firstDepositCount'] == report['depositCount'] == 1
assert report['firstDepositAmount'] == report['depositAmount'] == 1000
rows = call('/api/agent/report/details', dict(root, kind='first-deposit'))['items']
assert rows[0]['depth'] == 2 and rows[0]['amount'] == 1000
assert not call('/api/agent/report/details', dict(root, kind='deposit', scope='direct'))['items']
print('Agent HTTP smoke passed: permanent hierarchy, subtree authorization, reports, first principal, filters, rates, claims and trace IDs.')
