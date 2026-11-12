"""Replace remaining first-game graphics with reference assets without moving scene nodes."""
from pathlib import Path
import argparse,json,plistlib,re,shutil,uuid
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];assets=root/'assets';reference=args.source.resolve()/'assets/mahjongwaytwo/res/image';namespace=uuid.uuid5(uuid.NAMESPACE_URL,'aislots/mahjongway2/loading')
index={}
for p in assets.rglob('*.meta'):
 try:d=json.loads(p.read_text())
 except ValueError:continue
 if d.get('uuid'):index[d['uuid']]=p.with_suffix('')
def refs(o):
 if isinstance(o,dict):
  for v in o.values():yield from refs(v)
 elif isinstance(o,list):
  for v in o:yield from refs(v)
 elif isinstance(o,str)and re.fullmatch(r'[a-fA-F0-9]{8}-[a-fA-F0-9-]{27}(?:@.*)?',o):yield o.split('@')[0]
def reachable(paths):
 seen=set();queue=list(paths)
 while queue:
  p=queue.pop()
  if p in seen or not p.is_file():continue
  seen.add(p)
  if p.suffix == '.fnt':
   queue.extend(p.parent/name for name in re.findall(r'file="([^"]+)"',p.read_text()))
  if p.suffix == '.plist':
   atlas=plistlib.loads(p.read_bytes());queue.append(p.parent/atlas['metadata']['textureFileName'])
  for f in[p,Path(str(p)+'.meta')]:
   try:d=json.loads(f.read_text())
   except (ValueError,UnicodeDecodeError,FileNotFoundError):continue
   queue.extend(index[key]for key in refs(d)if key in index)
 return seen
base=assets/'resources/mahjong_effects';old_particles=[base/'mahjongway/res/load/prefab/games'/(n+'.prefab')for n in['bw_particle_a','bw_particle_b']];stop=base/'control_stop.prefab';candidates=reachable([stop,*old_particles])
meta=json.loads((assets/'mahjongway2/res/texture1/base/c515290e-3d74-492e-977a-a2c1da85cdf0.3cec8.plist.meta').read_text());data=json.loads(stop.read_text())
for node in data:
 if node.get('__type__')=='cc.Node'and node.get('_name')in['sb_arrow_blur','sb_arrow_grey']:
  name='spin_arrow_blur'if node['_name']=='sb_arrow_blur'else'spin_arrow_grey';frame=next(v['uuid']for v in meta['subMetas'].values()if v.get('name')==name)
  for component in node['_components']:
   sprite=data[component['__id__']]
   if sprite.get('__type__')=='cc.Sprite':sprite['_spriteFrame']['__uuid__']=frame
stop.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
scene=assets/'mahjongway2/mahjongway2.scene';data=json.loads(scene.read_text());bad={key for key,p in index.items()if p.name.startswith('2f32ef15-62a7-48a1-a1c6-3f1c2c0ad4f8.')}
for obj in data:
 if obj.get('__type__')=='cc.Sprite'and set(refs(obj))&bad:obj['_spriteFrame']=None;obj['_atlas']=None;obj['_enabled']=False
# Retain the launch node, but let it reference a copy in texture1 from the target project.
old=index.get('ff08c087-26ea-491e-9142-824e94b0dc26');remap={}
loading=assets/'mahjongway2/res/texture1/loading';loading.mkdir(parents=True,exist_ok=True)
for name in ['lauch.jpg','jdt.png','jdt1.png']:
 src=reference/'loading'/name;dest=loading/name;shutil.copy2(src,dest);m=json.loads(Path(str(src)+'.meta').read_text());new=str(uuid.uuid5(namespace,name));remap[m['uuid']]=new
 if name=='lauch.jpg':
  remap['ff08c087-26ea-491e-9142-824e94b0dc26']=new
  m.setdefault('userData',{})['type']='sprite-frame'
  m['userData']['redirect']=m['uuid']+'@f9941'
 def rewrite(o):
  if isinstance(o,dict):return{k:rewrite(v)for k,v in o.items()}
  if isinstance(o,list):return[rewrite(v)for v in o]
  if isinstance(o,str)and o.split('@')[0]in remap:return remap[o.split('@')[0]]+('@'+o.split('@',1)[1]if'@'in o else'')
  return o
 Path(str(dest)+'.meta').write_text(json.dumps(rewrite(m),indent=2)+'\n')
 if name.startswith('jdt'):
  for folder in ['preview-template/loading','build-templates/web-mobile/loading']:(root/folder).mkdir(parents=True,exist_ok=True);shutil.copy2(src,root/folder/name)
foldermeta=Path(str(loading)+'.meta')
if not foldermeta.exists():foldermeta.write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid5(namespace,'folder')),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
scene.write_text(json.dumps(rewrite(data),ensure_ascii=False,indent=2)+'\n')
for p in loading.glob('*.meta'):
 d=json.loads(p.read_text());index[d['uuid']]=p.with_suffix('')
keep=reachable([scene,*[p for p in base.rglob('*.prefab')if p not in old_particles]])
manifest=root/'tools/legacy_art_cleanup.json'
removed=json.loads(manifest.read_text()).get('removed',[]) if manifest.exists() else []
# The old imported subtree has no directory loads: retain the complete dependency
# closure of all prefabs and the scene, including bitmap-font and atlas pages.
candidates.update(p for p in (base/'mahjongway/res').rglob('*') if p.is_file() and p.suffix != '.meta')
for p in sorted(candidates-keep):
 if base in p.parents:
  p.unlink();m=Path(str(p)+'.meta')
  if m.exists():m.unlink()
  removed.append(str(p.relative_to(assets)))
removed=sorted(set(removed))
print('Removed',len(removed),'unreferenced legacy particle/arrow assets')
(root/'tools/legacy_art_cleanup.json').write_text(json.dumps({'source':args.source.name,'removed':removed},indent=2)+'\n')
