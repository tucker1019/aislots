"""Import the four reference popups and dependencies, preserving current public prefab UUIDs."""
import argparse, hashlib, json, pathlib, plistlib, re, shutil, uuid
parser=argparse.ArgumentParser();parser.add_argument('project');parser.add_argument('--engine-assets',default='/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/editor/assets');args=parser.parse_args()
src=pathlib.Path(args.project).resolve()/'assets';assets=pathlib.Path(__file__).resolve().parents[1]/'assets'
source_root=src/'mahjongwaytwo/res/load/prefab/games';dest_root=assets/'resources/mahjong_effects/mahjongway/res/load/prefab/games'
names=['pop_free_tri','pop_free_again','pop_free_end','big_win'];index={};local={}
for root,lookup in [(src,index),(assets,local)]:
 for meta in root.rglob('*.meta'):
  data=json.loads(meta.read_text());key=data.get('uuid')
  if key:lookup[key]=meta.with_suffix('')
builtins={json.loads(p.read_text()).get('uuid') for p in pathlib.Path(args.engine_assets).rglob('*.meta')}
roots={json.loads(pathlib.Path(str(source_root/(n+'.prefab'))+'.meta').read_text())['uuid']:dest_root/(n+'.prefab') for n in names}
mapping={key:json.loads(pathlib.Path(str(p)+'.meta').read_text())['uuid'] for key,p in roots.items()}
namespace=uuid.uuid5(uuid.NAMESPACE_URL,'aislots/mahjongway2/reference-popups')
pattern=re.compile(r'^([0-9a-fA-F]{8}-[0-9a-fA-F-]{27})(@.*)?$')
def references(obj):
 if isinstance(obj,dict):
  for value in obj.values():yield from references(value)
 elif isinstance(obj,list):
  for value in obj:yield from references(value)
 elif isinstance(obj,str):
  match=pattern.fullmatch(obj)
  if match:yield match[1]
def clean(data):
 for o in data:
  if o.get('__type__')=='12eb3dTT5VNH5mDXgFJqjt4':o['__type__']='fa1638wUmZDrIAAJvGGnFR2'
  if o.get('__type__')=='cc.Button':o['clickEvents']=[]
 for o in data:
  if o.get('__type__')=='cc.Node':o['_components']=[r for r in o.get('_components',[]) if data[r['__id__']].get('__type__','').startswith('cc.') or data[r['__id__']].get('__type__')=='fa1638wUmZDrIAAJvGGnFR2']
 reachable=set()
 def visit(i):
  if i in reachable:return
  reachable.add(i)
  def walk(o):
   if isinstance(o,dict):
    if '__id__' in o:visit(o['__id__'])
    else:
     for v in o.values():walk(v)
   elif isinstance(o,list):
    for v in o:walk(v)
  walk(data[i])
 visit(0);order=sorted(reachable);ids={old:new for new,old in enumerate(order)}
 def remap(o):
  if isinstance(o,dict):return {'__id__':ids[o['__id__']]} if '__id__' in o else {k:remap(v) for k,v in o.items()}
  if isinstance(o,list):return [remap(v) for v in o]
  return o
 return [remap(data[i]) for i in order]
queue=list(roots);collected={};external=set()
while queue:
 key=queue.pop()
 if key in collected or key in external:continue
 p=index.get(key)
 if p is None:
  if key not in local and key not in builtins:raise RuntimeError('Unresolved external dependency '+key)
  external.add(key);continue
 if p.is_dir():continue
 if p.suffix=='.ts':raise RuntimeError('Unexpected script dependency '+str(p))
 meta=json.loads(pathlib.Path(str(p)+'.meta').read_text());data=None
 try:data=json.loads(p.read_text())
 except (ValueError,UnicodeDecodeError):pass
 if p.suffix=='.prefab':data=clean(data)
 if key not in mapping:mapping[key]=str(uuid.uuid5(namespace,key))
 collected[key]=(p,meta,data)
 queue.extend(references(meta));queue.extend(references(data))
 if p.suffix=='.plist':
  image=plistlib.loads(p.read_bytes())['metadata']['textureFileName'];queue.append(json.loads(pathlib.Path(str(p.parent/image)+'.meta').read_text())['uuid'])
 if p.suffix=='.fnt' and data is None:
  for image in re.findall(r'file="([^"]+)"',p.read_text()):queue.append(json.loads(pathlib.Path(str(p.parent/image)+'.meta').read_text())['uuid'])
def rewrite(o):
 if isinstance(o,dict):return {k:rewrite(v) for k,v in o.items()}
 if isinstance(o,list):return [rewrite(v) for v in o]
 if isinstance(o,str):
  m=pattern.fullmatch(o)
  if m and m[1] in mapping:return mapping[m[1]]+(m[2] or '')
 return o
written=[];binary_hashes={}
for key,(p,meta,data) in collected.items():
 texture=p.suffix.lower() in ['.png','.jpg','.jpeg','.webp','.plist','.fnt']
 target=roots.get(key) or (assets/('mahjongway2/res/texture1/popups' if texture else 'resources/mahjong_effects/ag2_popups')/p.relative_to(src))
 target.parent.mkdir(parents=True,exist_ok=True)
 if data is None:
  shutil.copy2(p,target);binary_hashes[str(target.relative_to(assets))]=hashlib.sha256(p.read_bytes()).hexdigest()
 else:target.write_text(json.dumps(rewrite(data),ensure_ascii=False,indent=2)+'\n')
 if key in roots:meta['ver']='1.1.50'
 pathlib.Path(str(target)+'.meta').write_text(json.dumps(rewrite(meta),indent=2)+'\n')
 written.append(str(target.relative_to(assets)))
for root in [assets/'mahjongway2/res/texture1/popups',assets/'resources/mahjong_effects/ag2_popups']:
 for folder in [root,*sorted(p for p in root.rglob('*') if p.is_dir())]:
  meta=pathlib.Path(str(folder)+'.meta')
  if not meta.exists():meta.write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid5(namespace,str(folder.relative_to(assets)))),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
manifest={'source':'mahjongway2_1024','prefabs':names,'assets':sorted(written),'uuidMapping':mapping,'externalUUIDs':sorted(external),'binarySourceHashes':binary_hashes}
(assets.parent/'tools/popup_assets_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Imported',len(collected),'assets; reused',len(external),'existing external assets')
