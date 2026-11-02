"""HTTP contract smoke against a running lobby, creates a visitor with no game events."""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

base = os.environ.get('LOBBY_SMOKE_URL', 'http://127.0.0.1:8081')

def call(path, body=None, expected=200):
    request = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    data = json.load(response)
    assert response.status == expected, (response.status, data)
    assert response.headers['X-Trace-Id']
    return data.get('data', data)

visitor = call('/api/user/account/visitor/login', {})
identity = {key: visitor[key] for key in ('uid', 'sid')}
query = urllib.parse.urlencode(identity)
rebate = call('/api/activity/rebate/info?' + query)
loser = call('/api/activity/loserreturn/info?' + query)
assert rebate['claimableTotal'] == loser['claimableTotal'] == 0
assert rebate['activityDate'] == loser['activityDate']
for kind, rate in [('daily', 80), ('weekly', 10), ('monthly', 10)]:
    item = rebate[kind]
    assert item['claim']['type'] == kind
    assert item['claim']['rateBps'] == rate
    assert item['claim']['status'] in ('no_reward', 'expired')
    assert item['preview']['status'] == 'preview'
    assert item['preview']['reward'] == 0
    assert isinstance(item['claim']['validBet'], int)
assert loser['daily']['claim']['type'] == 'loser_return'
assert loser['daily']['claim']['rateBps'] == 1000
assert loser['daily']['preview']['betAmount'] == loser['daily']['preview']['winAmount'] == 0
for prefix in ('rebate', 'loserreturn'):
    error = call(f'/api/activity/{prefix}/claim', dict(identity, activityDate=rebate['activityDate']), 400)
    assert error['code'] == 10010015
    error = call(f'/api/activity/{prefix}/claim', dict(identity, activityDate='2000-01-01'), 409)
    assert error['code'] == 10010014
    call(f'/api/activity/{prefix}/claim', dict(identity, activityDate='bad'), 400)
    call(f'/api/activity/{prefix}/info?uid=1&sid=bad', expected=401)
assert call('/api/user/user/info?' + query)['coins'] == 0
print('Returns HTTP smoke passed: separate daily/weekly/monthly/loser amounts, previews, numeric money, dates and auth.')
