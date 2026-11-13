"""Local static server; --mock uses isolated fixtures and never forwards to a game server."""
import argparse,json,pathlib,functools
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=5182);p.add_argument('--mock',action='store_true');p.add_argument('--pending',action='store_true');args=p.parse_args()
if args.pending and not args.mock:p.error('--pending requires --mock')
root=pathlib.Path(__file__).resolve().parents[1]/'build/web-mobile'
heights=[3,4,5,5,4,3]
def board(seed=0):return [[{'id':c*100+r+1,'symbolId':(r+c+seed)%8+1} for r in range(h+1)] for c,h in enumerate(heights)]
def frame(index):
 b=board();win=index in [0,2];free=index>=2
 if index==1:
  for c in [0,1,2]:b[c][1]['symbolId']=10
 if index==2:
  for c in [0,1,2]:b[c][1]['symbolId']=7
 return {'requestId':'mock-'+str(index),'nextRequestId':'mock-'+str(index+1),'betId':'mock-order','spinIndex':int(free),'stepIndex':index%2+1,'mode':'free' if free else 'base','nextAction':'continue' if win else ('start_free' if index==1 else 'complete'),'previewRows':1,'board':b,'wins':[{'symbolId':7,'cellIds':[2,102,202]}] if win else [],'removedIds':[2,102,202] if win else [],'transformedIds':[],'balance':100000+index*20,'betAmount':200 if not free else 0,'winAmount':20 if win else 0,'spinWinAmount':20,'totalWinAmount':20 if index<2 else 40,'freeRemaining':1 if index<2 else 0,'awardedFreeSpins':1 if index<2 else 0,'triggeredFree':index<2,'cascadeFactors':['8','16','32'] if free else ['1','2','4'],'cascadeIndex':index%2}
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  path=self.path.split('?')[0]
  if args.mock and path.startswith('/api/v1/'):
   if path.endswith('/bet-records'):
    item={'betId':'mock-order','gameId':'AG3','betAmount':'200','totalWinAmount':'40','profitAmount':'-160','winningRoundCount':2,'totalRoundCount':4,'status':'complete','country':'ID','currency':'IDR','createdAt':'2026-11-12T06:00:00Z','updatedAt':'2026-11-12T06:01:00Z'}
    return self.send_json({'items':[item],'summary':{'recordCount':1,'betAmount':'200','totalWinAmount':'40','profitAmount':'-160'},'amountScale':2})
   if '/replay' in path or '/shared-replays/' in path:
    item={'betId':'mock-order','gameId':'AG3','betAmount':'200','totalWinAmount':'40','profitAmount':'-160','winningRoundCount':2,'totalRoundCount':4,'status':'complete','country':'ID','currency':'IDR','createdAt':'2026-11-12T06:00:00Z','updatedAt':'2026-11-12T06:01:00Z'}
    frames=[dict(frame(i),chargeAmount='200' if i==0 else '0',profitAmount='-180' if i==0 else '0',payouts=[],settledAt='2026-11-12T06:00:00Z') for i in range(4)]
    return self.send_json({'bet':item,'frames':frames,'amountScale':2})
   if path.endswith('/bets'):return self.send_json({'betOptions':['10','50','100','500','1000'],'defaultBet':'10','lineCount':20,'betLevel':10})
   if path.endswith('/state'):return self.send_json({'requestId':'mock-1','balance':100000,'hasNext':True,'betAmount':200,'lastFrame':frame(0)} if args.pending else {'requestId':'mock-0','balance':100000,'hasNext':False})
   return self.send_json({},404)
  return super().do_GET()
 def do_POST(self):
  raw=self.rfile.read(int(self.headers.get('Content-Length',0)))
  if args.mock and self.path=='/api/v1/login':return self.send_json({'accessToken':'mock-only'})
  if args.mock and self.path.endswith('/share'):return self.send_json({'shareToken':'mock-public'})
  if args.mock and self.path.endswith('/spin'):
   data=json.loads(raw);assert data['bet']=='10' and data['betLevel']==1
   return self.send_json(frame(min(3,int(data['requestId'].split('-')[-1]))))
  self.send_json({},404)
 def send_json(self,data,status=200):
  content=json.dumps({'code':'OK' if status==200 else 'ERROR','data':data}).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)
 def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
server=ThreadingHTTPServer(('127.0.0.1',args.port),functools.partial(Handler,directory=str(root)))
print('AG3 fixture server' if args.mock else 'AG3 static server',args.port,flush=True);server.serve_forever()
