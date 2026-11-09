"""只补入参考项目的图标赔率浮层，不覆盖已有场景修改。"""
import copy
from prefab_metadata import ensure_prefab_metadata
import json
import pathlib
import plistlib
import re
import shutil

project = pathlib.Path(__file__).resolve().parents[1]
assets = project / 'assets'
source = pathlib.Path('/Users/yaozhao/cccProject/mahjongway1_1025/assets')
reference = json.loads((source / 'mahjongway/res/load/prefab/games/mult_panel.prefab').read_text())

# 先清除所有外部预制体/业务引用，再只提取图标赔率浮层可到达的节点和原生组件。
root = next(i for i, n in enumerate(reference) if n.get('__type__') == 'cc.Node' and n.get('_name') == 'mult_panel')
# 原来的 cell_win 是嵌套旧组件，改由当前 NativeEffect 提供图标。
reference[root]['_children'] = [r for r in reference[root]['_children'] if reference[r['__id__']].get('_name') in ['labels', 'other']]
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


# 生成独立可编辑预制体，避免覆盖当前编辑器里的场景修改。
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
prefab = {'__type__':'cc.Prefab', '_name':'mult_panel', '_objFlags':0,
          '_native':'', 'data':{'__id__':mapping[root]}, 'optimizationPolicy':0,
          'persistent':False, 'asyncLoadAssets':False}
destination = assets / 'resources/mahjong_effects/mult_panel.prefab'
destination.write_text(json.dumps(ensure_prefab_metadata([prefab] + nodes), ensure_ascii=False, indent=2) + '\n')
print('Imported mult_panel prefab:', len(nodes), 'objects')
