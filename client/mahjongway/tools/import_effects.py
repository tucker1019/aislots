"""复制原生Cocos预制体及UUID依赖，不修改源项目或引入旧网络/业务脚本。"""
import json,pathlib,shutil,uuid,re,sys,plistlib
src=pathlib.Path(sys.argv[1]).resolve()/'assets';assets=pathlib.Path(__file__).resolve().parents[1]/'assets';out=assets/'resources/mahjong_effects';out.mkdir(parents=True,exist_ok=True)
index={};existing={}
for root,lookup in [(src,index),(assets,existing)]:
 for meta in root.rglob('*.meta'):
  if root==assets and out in meta.parents:continue
  try:d=json.loads(meta.read_text())
  except:continue
  if 'uuid' in d:lookup[d['uuid']]=meta.with_suffix('')
# 原预制体只有此显示组件需要保留；其余旧控制器由当前游戏流程接管。
SPRITE='fa1638wUmZDrIAAJvGGnFR2';copied={};queue=[]
def refs(obj):
 if isinstance(obj,str) and re.fullmatch(r'[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}(?:@.*)?',obj):queue.append(obj.split('@')[0])
 if isinstance(obj,dict):
  if '__uuid__' in obj:queue.append(obj['__uuid__'].split('@')[0])
  for v in obj.values():refs(v)
 elif isinstance(obj,list):
  for v in obj:refs(v)
def clean_prefab(data):
 for obj in data:
  if not isinstance(obj,dict):continue
  if obj.get('__type__')=='cc.Button':obj['clickEvents']=[]
  if obj.get('__type__')=='cc.Node':obj['_components']=[r for r in obj.get('_components',[]) if data[r['__id__']].get('__type__','').startswith('cc.') or data[r['__id__']].get('__type__')==SPRITE]
 reachable=set()
 def walk(i):
  if i in reachable:return
  reachable.add(i)
  def scan(o):
   if isinstance(o,dict):
    if '__id__' in o:walk(o['__id__'])
    else:
     for v in o.values():scan(v)
   elif isinstance(o,list):
    for v in o:scan(v)
  scan(data[i])
 walk(0);order=sorted(reachable);mapping={old:new for new,old in enumerate(order)}
 def remap(o):
  if isinstance(o,dict):return {'__id__':mapping[o['__id__']]} if '__id__' in o else {k:remap(v) for k,v in o.items()}
  if isinstance(o,list):return [remap(v) for v in o]
  return o
 return [remap(data[i]) for i in order]
def prefab_metadata(data):
 # 从场景提取的节点没有PrefabInfo；编辑器打开预制体时需要这些关联。
 root=data[0]['data']['__id__']
 for i,obj in list(enumerate(data)):
  if obj.get('__type__')=='cc.Node':
   obj['_objFlags']=0
   obj['_prefab']={'__id__':len(data)}
   data.append({'__type__':'cc.PrefabInfo','root':{'__id__':root},'asset':{'__id__':0},'fileId':obj.get('_id') or str(uuid.uuid4()),'instance':None})
  elif 'node' in obj and '__prefab' in obj:
   obj['__prefab']={'__id__':len(data)}
   data.append({'__type__':'cc.CompPrefabInfo','fileId':obj.get('_id') or str(uuid.uuid4())})
 return data
for name in ['cell_win','pop_free_tri','pop_free_again','pop_free_end','big_win','node_anti','bw_particle_a','bw_particle_b']:
 p=src/'mahjongway/res/load/prefab/games'/(name+'.prefab');queue.append(json.loads(pathlib.Path(str(p)+'.meta').read_text())['uuid'])
# 将原场景倍率条提取为独立预制体，排除依赖原场景层级的Widget。
a=json.loads((src/'mahjongway/res/MWGameScene.scene').read_text());a[52]['_parent']=None
for obj in a:
 if isinstance(obj,dict) and obj.get('__type__')=='cc.Node':obj['_components']=[r for r in obj.get('_components',[]) if a[r['__id__']].get('__type__')!='cc.Widget']
a[0]={'__type__':'cc.Prefab','_name':'multipliers','data':{'__id__':52},'optimizationPolicy':0,'persistent':False}
a=prefab_metadata(clean_prefab(a));refs(a);p=out/'multipliers.prefab';p.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
if not pathlib.Path(str(p)+'.meta').exists():pathlib.Path(str(p)+'.meta').write_text(json.dumps({'ver':'1.1.50','importer':'prefab','imported':True,'uuid':str(uuid.uuid4()),'files':['.json'],'subMetas':{},'userData':{}},indent=2)+'\n')
# 按钮表现也提取为预制体；点击事件继续由当前场景控制器处理。
for name,root_id in [('control_spin',295),('control_stop',311),('control_turbo',249)]:
 a=json.loads((src/'mahjongway/res/MWGameScene.scene').read_text());a[root_id]['_parent']=None
 for obj in a:
  if isinstance(obj,dict) and obj.get('__type__')=='cc.Node':obj['_components']=[r for r in obj.get('_components',[]) if a[r['__id__']].get('__type__') not in ['cc.Widget','cc.Button']]
 a[0]={'__type__':'cc.Prefab','_name':name,'data':{'__id__':root_id},'optimizationPolicy':0,'persistent':False}
 a=prefab_metadata(clean_prefab(a));refs(a);p=out/(name+'.prefab');p.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
 if not pathlib.Path(str(p)+'.meta').exists():pathlib.Path(str(p)+'.meta').write_text(json.dumps({'ver':'1.1.50','importer':'prefab','imported':True,'uuid':str(uuid.uuid4()),'files':['.json'],'subMetas':{},'userData':{}},indent=2)+'\n')
# 拷贝演出音效，引用路径固定在resources中。
for name in ['symbolShrink','symbolWild','symbolCollapse','multiplierA','multiplierB','multiplierC','symbolScatter','fastspinStart','fastspinEnd','bgmBonusIntro','uiStart','uiCollect','bgmBigwinMain','bgmBigwinEnd','bgmTotalwinMain','bgmTotalwinEnd']:
 p=src/'mahjongway/res/sound/games'/(name+'.mp3')
 if p.exists():queue.append(json.loads(pathlib.Path(str(p)+'.meta').read_text())['uuid'])
while queue:
 key=queue.pop()
 if key in copied or key in existing:continue
 p=index.get(key)
 if p is None:continue # 引擎内置材质与纹理由Cocos提供。
 if p.suffix=='.ts':continue
 if p.is_dir():continue
 dest=out/p.relative_to(src);dest.parent.mkdir(parents=True,exist_ok=True)
 if p.suffix in ['.prefab','.anim','.mtl','.material','.json','.fnt']:
  try:
   data=json.loads(p.read_text());data=clean_prefab(data) if p.suffix=='.prefab' else data;refs(data);dest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
  except (ValueError,UnicodeDecodeError):shutil.copy2(p,dest)
 else:shutil.copy2(p,dest)
 meta=json.loads(pathlib.Path(str(p)+'.meta').read_text());refs(meta);pathlib.Path(str(dest)+'.meta').write_text(json.dumps(meta,indent=2)+'\n');copied[key]=dest
 if p.suffix=='.plist':
  image=plistlib.loads(p.read_bytes())['metadata']['textureFileName'];m=pathlib.Path(str(p.parent/image)+'.meta')
  if m.exists():queue.append(json.loads(m.read_text())['uuid'])
 # 位图字体的page文件不是JSON UUID引用，需要显式收集。
 if p.suffix=='.fnt':
  for image in re.findall(r'file="([^"]+)"',p.read_text()):
   m=pathlib.Path(str(p.parent/image)+'.meta')
   if m.exists():queue.append(json.loads(m.read_text())['uuid'])
for folder in [assets/'resources',*sorted((p for p in out.rglob('*') if p.is_dir())),out]:
 meta=pathlib.Path(str(folder)+'.meta')
 if not meta.exists():meta.write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
script=assets/'mahjongway/src/effects/MWSpriteCtrl.ts';script.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src/'mahjongway/src/game/view/layer/MWSpriteCtrl.ts.meta',str(script)+'.meta')
print('Copied',len(copied),'native assets')
