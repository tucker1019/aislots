"""Extract reference free skin frames without adding dependencies to the launch scene."""
import copy,json,pathlib,plistlib,re,shutil,sys,uuid
from prefab_metadata import ensure_prefab_metadata
assets=pathlib.Path(__file__).resolve().parents[1]/'assets'
source=pathlib.Path(sys.argv[1]).resolve()/'assets'
reference=json.loads((source/'mahjongwaytwo/res/MWTGameScene.scene').read_text())
index={};local={}
for folder,lookup in [(source,index),(assets,local)]:
 for p in folder.rglob('*.meta'):
  d=json.loads(p.read_text())
  if d.get('uuid'):lookup[d['uuid']]=p.with_suffix('')
def find(name):return next(o for o in reference if o.get('__type__')=='cc.Node'and o.get('_name')==name)
def free_frame(node):
 ctrl=next(reference[r['__id__']]for r in node['_components']if 'sprList'in reference[r['__id__']])
 return copy.deepcopy(ctrl['sprList'][1])
queue=[]
def refs(o):
 if isinstance(o,dict):
  for v in o.values():refs(v)
 elif isinstance(o,list):
  for v in o:refs(v)
 elif isinstance(o,str)and re.fullmatch(r'[a-fA-F0-9]{8}-[a-fA-F0-9-]{27}(?:@.*)?',o):queue.append(o.split('@')[0])
root=copy.deepcopy(find('bg'));root.update(_name='free_background_skin',_parent=None,_children=[],_components=[],_prefab=None,_active=False,_lpos={'__type__':'cc.Vec3','x':0,'y':0,'z':0})
root['_id']=str(uuid.uuid5(uuid.NAMESPACE_URL,'aislots/AG2/free-background-skin/root'))
data=[{'__type__':'cc.Prefab','_name':'free_background_skin','data':{'__id__':1},'optimizationPolicy':0,'persistent':False},root]
for src_name,name in [('bg','reel_a'),('ui_bg_a','ui_bg_a'),('ui_bg_b','ui_bg_b'),('ui_bg_c','ui_bg_c'),('ui_footer','ui_footer'),('infoboard_lv01_mask','infoboard_lv01_mask'),('infoboard_lv01_mask-001','infoboard_lv01_mask-001')]:
 original=find(src_name);node=copy.deepcopy(original);node.update(_name=name,_parent={'__id__':1},_children=[],_components=[],_prefab=None,_active=True)
 i=len(data);root['_children'].append({'__id__':i});data.append(node)
 for r in original['_components']:
  c=copy.deepcopy(reference[r['__id__']])
  if c.get('__type__')not in ('cc.UITransform','cc.Sprite'):continue
  c['node']={'__id__':i};c['__prefab']=None
  if c['__type__']=='cc.Sprite':c['_spriteFrame']=free_frame(original);c['_atlas']=None;refs(c['_spriteFrame'])
  node['_components'].append({'__id__':len(data)});data.append(c)
ns=uuid.uuid5(uuid.NAMESPACE_URL,'aislots/AG2/free-background-skin')
folder=assets/'mahjongway2/res/texture1/free_background'
while queue:
 key=queue.pop()
 if key in local:continue
 src=index.get(key)
 if not src or not src.is_file():raise ValueError('Missing reference skin asset '+key)
 dest=folder/src.relative_to(source);dest.parent.mkdir(parents=True,exist_ok=True)
 shutil.copy2(src,dest);shutil.copy2(str(src)+'.meta',str(dest)+'.meta');local[key]=dest
 refs(json.loads(pathlib.Path(str(src)+'.meta').read_text()))
 try:refs(json.loads(src.read_text()))
 except (ValueError,UnicodeDecodeError):pass
 if src.suffix=='.plist':
  image=src.parent/plistlib.loads(src.read_bytes())['metadata']['textureFileName']
  queue.append(json.loads(pathlib.Path(str(image)+'.meta').read_text())['uuid'])
for p in sorted([folder,*[p for p in folder.rglob('*')if p.is_dir()]]):
 meta=pathlib.Path(str(p)+'.meta')
 if not meta.exists():meta.write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid5(ns,str(p.relative_to(assets)))),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
p=assets/'resources/mahjong_effects/free_background_skin.prefab'
p.write_text(json.dumps(ensure_prefab_metadata(data),ensure_ascii=False,indent=2)+'\n')
meta=pathlib.Path(str(p)+'.meta')
if not meta.exists():meta.write_text(json.dumps({'ver':'1.1.50','importer':'prefab','imported':True,'uuid':str(uuid.uuid5(ns,'prefab')),'files':['.json'],'subMetas':{},'userData':{}},indent=2)+'\n')
print('Imported five free backgrounds and two information-bar edges')
