"""Export only game artwork from the 1024 reference; keep the shared HTML page layout."""
from pathlib import Path
from PIL import Image
import argparse,base64,hashlib,io,json,plistlib,re,uuid
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);args=parser.parse_args()
project=Path(__file__).resolve().parents[1];source=args.source.resolve();assets=source/'assets';frames={};used={}
for p in sorted(assets.rglob('*.plist')):
 try:atlas=plistlib.loads(p.read_bytes())
 except (ValueError,plistlib.InvalidFileException):continue
 for name,frame in atlas.get('frames',{}).items():frames[name]=(p,atlas,frame)
def frame(name):
 p,atlas,rect=frames[name];image=p.parent/atlas['metadata']['textureFileName'];used[str(p.relative_to(assets))]=hashlib.sha256(p.read_bytes()).hexdigest();used[str(image.relative_to(assets))]=hashlib.sha256(image.read_bytes()).hexdigest()
 x,y,w,h=map(int,re.findall(r'-?\d+',rect['frame']));img=Image.open(image).convert('RGBA')
 if rect.get('rotated'):return img.crop((x,y,x+h,y+w)).transpose(Image.Transpose.ROTATE_90)
 return img.crop((x,y,x+w,y+h))
output=project/'assets/mahjongway2/res/texture1/history';output.mkdir(parents=True,exist_ok=True);art={};hashes={}
namespace=uuid.uuid5(uuid.NAMESPACE_URL,'aislots/mahjongway2/history-art')
def store(key,image):
 stream=io.BytesIO();image.save(stream,format='PNG',optimize=True);data=stream.getvalue();art[key]='data:image/png;base64,'+base64.b64encode(data).decode();hashes[key]=hashlib.sha256(data).hexdigest();p=output/(key+'.png');p.write_bytes(data)
 meta=Path(str(p)+'.meta')
 if not meta.exists():meta.write_text(json.dumps({'ver':'1.0.27','importer':'image','imported':True,'uuid':str(uuid.uuid5(namespace,key)),'files':['.json','.png'],'subMetas':{},'userData':{'type':'raw','hasAlpha':True}},indent=2)+'\n')
# These are current server symbol IDs, independent of reference scene artwork IDs.
symbols={1:'low_payout_03',2:'low_payout_01',3:'low_payout_02',4:'low_payout_04',5:'low_payout_05',6:'low_payout_06',7:'high_payout_01',8:'high_payout_02',9:'high_payout_03'}
native=json.loads((assets/'mahjongwaytwo/res/load/prefab/games/cell_win.prefab').read_text())
nodes={n['_name']:n for n in native if n.get('__type__')=='cc.Node'}
artwork={1:3,2:1,3:2,4:4,5:5,6:6,7:7,8:8,9:9}
def place(tile,image,node):
 scale=node['_lscale'];position=node['_lpos']
 if scale['x']!=1 or scale['y']!=1:image=image.resize((round(image.width*scale['x']),round(image.height*scale['y'])),Image.Resampling.LANCZOS)
 tile.alpha_composite(image,(round((tile.width-image.width)/2+position['x']),round((tile.height-image.height)/2-position['y'])))
for symbol,name in symbols.items():
 icon=frame(name+'.png')
 for gold in [False,True]:
  tile=frame('symbol_base_gold.png'if gold else'symbol_bg.png');place(tile,icon,nodes['c'+str(artwork[symbol])])
  if gold:
   ingot=frame('symbol_base_gold_ingot.png');place(tile,ingot,nodes['gold_ingot'])
  store(str(symbol+(1000 if gold else 0)),tile)
def transparent_screen(image):
 # Convert an opaque black-backed additive sprite into straight-alpha pixels.
 # The existing screen blend then preserves the reference glow without a black box.
 output=Image.new('RGBA',image.size)
 output.putdata([(round(r*255/a),round(g*255/a),round(b*255/a),a) if (a:=max(r,g,b)) else (0,0,0,0) for r,g,b,_ in image.getdata()])
 return output
store('10',frame('wild_b.png'));store('wild_base',frame('wild_a.png'));store('11',frame('s_scatter.png'));store('scatter_background',transparent_screen(frame('scatter_bg.png')))
for factor in [1,2,3,4,5,6,10]:
 store('multiplier_light_'+str(factor),frame('x'+str(factor)+'.png'))
 store('multiplier_gray_'+str(factor),frame(('n_x'if factor in[1,2,3,5]else'b_x')+str(factor)+'.png'))
store('multiplier_free_gray_2',frame('b_x2.png'));store('multiplier_background',frame('ui_top_bar.png'))
arrow=assets/'mahjongwaytwo/res/image/setting_menu/auto_arrow.png';used[str(arrow.relative_to(assets))]=hashlib.sha256(arrow.read_bytes()).hexdigest();store('arrow',Image.open(arrow).convert('RGBA'))
meta=Path(str(output)+'.meta')
if not meta.exists():meta.write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid5(namespace,'folder')),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
(project/'assets/resources/history/art.json').write_text(json.dumps(art,separators=(',',':'))+'\n')
(project/'tools/history_art_manifest.json').write_text(json.dumps({'source':source.name,'sourceFiles':used,'images':hashes},indent=2)+'\n')
print('Exported',len(art),'native second-game history images')
