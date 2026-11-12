"""只导入参考 ui_reel 的免费背景粒子及原生依赖，不覆盖已有资源。"""
import copy
import sys
from prefab_metadata import ensure_prefab_metadata
import json
import pathlib
import plistlib
import re
import shutil

project = pathlib.Path(__file__).resolve().parents[1]
assets = project / 'assets'
source = pathlib.Path(sys.argv[1]) / 'assets'
name = sys.argv[2]
reference = json.loads((source / 'mahjongwaytwo/res/MWTGameScene.scene').read_text())

# 只提取 ui_reel 上方粒子节点及原生组件，移除外部场景引用。
root = next(i for i, n in enumerate(reference) if n.get('__type__') == 'cc.Node' and n.get('_name') == name)
for obj in reference:
    if obj.get('__type__') == 'cc.Node':
        obj['_components'] = [r for r in obj.get('_components', []) if reference[r['__id__']].get('__type__', '').startswith('cc.')]
        obj['_prefab'] = None
    if '__prefab' in obj:
        obj['__prefab'] = None
    if obj.get('__type__') == 'cc.Button':
        obj['clickEvents'] = []
reference[root]['_parent'] = None
seen = set()
def visit(value):
    if isinstance(value, dict):
        if '__id__' in value:
            index = value['__id__']
            if index not in seen:
                seen.add(index)
                visit(reference[index])
        else:
            for child in value.values():
                visit(child)
    elif isinstance(value, list):
        for child in value:
            visit(child)
visit({'__id__': root})

# 依赖资源只补缺失项，不覆盖当前工程已经调整过的美术、动画和meta。
source_index = {}
existing = set()
for folder, lookup in [(source, source_index), (assets, None)]:
    for meta in folder.rglob('*.meta'):
        try:
            info = json.loads(meta.read_text())
        except (ValueError, UnicodeDecodeError):
            continue
        if 'uuid' not in info:
            continue
        if lookup is not None:
            lookup[info['uuid']] = meta.with_suffix('')
        elif meta.with_suffix('').exists():
            existing.add(info['uuid'])
queue = []
def refs(value):
    if isinstance(value, str) and re.fullmatch(r'[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}(?:@.*)?', value):
        queue.append(value.split('@')[0])
    elif isinstance(value, dict):
        for child in value.values():
            refs(child)
    elif isinstance(value, list):
        for child in value:
            refs(child)
for index in seen:
    refs(reference[index])
copied = []
while queue:
    key = queue.pop()
    if key in existing:
        continue
    original = source_index.get(key)
    if original is None or not original.is_file() or original.suffix == '.ts':
        continue
    destination = assets / 'resources/mahjong_effects' / original.relative_to(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(original, destination)
    shutil.copy2(str(original) + '.meta', str(destination) + '.meta')
    existing.add(key)
    copied.append(str(destination))
    try:
        refs(json.loads(original.read_text()))
    except (ValueError, UnicodeDecodeError):
        pass
    refs(json.loads(pathlib.Path(str(original) + '.meta').read_text()))
    pages = []
    if original.suffix == '.plist':
        pages.append(plistlib.loads(original.read_bytes())['metadata']['textureFileName'])
    if original.suffix == '.fnt':
        pages.extend(re.findall(r'file="([^"]+)"', original.read_text()))
    for page in pages:
        meta = pathlib.Path(str(original.parent / page) + '.meta')
        if meta.exists():
            queue.append(json.loads(meta.read_text())['uuid'])


# 生成独立可编辑粒子预制体，避免覆盖当前场景修改。
indices = sorted(seen)
mapping = {old: 1 + offset for offset, old in enumerate(indices)}
def remap(value):
    if isinstance(value, dict):
        if '__id__' in value:
            return {'__id__': mapping[value['__id__']]}
        return {key: remap(child) for key, child in value.items()}
    if isinstance(value, list):
        return [remap(child) for child in value]
    return value
nodes = [remap(copy.deepcopy(reference[index])) for index in indices]
nodes[indices.index(root)]['_active'] = False
prefab = {'__type__':'cc.Prefab', '_name':name, '_objFlags':0,
          '_native':'', 'data':{'__id__':mapping[root]}, 'optimizationPolicy':0,
          'persistent':False, 'asyncLoadAssets':False}
destination = assets / ('resources/mahjong_effects/' + name + '.prefab')
destination.write_text(json.dumps(ensure_prefab_metadata([prefab] + nodes), ensure_ascii=False, indent=2) + '\n')
print('Imported', name, len(nodes), 'objects')

import uuid
for folder in [assets / 'resources/mahjong_effects', *sorted(p for p in (assets / 'resources/mahjong_effects').rglob('*') if p.is_dir())]:
 meta=pathlib.Path(str(folder)+'.meta')
 if not meta.exists():meta.write_text(json.dumps({'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n')
meta=pathlib.Path(str(destination)+'.meta')
if not meta.exists():meta.write_text(json.dumps({'ver':'1.1.50','importer':'prefab','imported':True,'uuid':str(uuid.uuid4()),'files':['.json'],'subMetas':{},'userData':{}},indent=2)+'\n')
