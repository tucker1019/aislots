"""导入底部菜单纯美术，保留当前游戏的Spin/Stop绑定，不导入源项目业务。"""
import copy
import json
import pathlib
import plistlib
import re
import shutil
import uuid

project = pathlib.Path(__file__).resolve().parents[1]
assets = project / 'assets'
source = pathlib.Path('/Users/yaozhao/cccProject/mahjongway1_1025/assets')
scene_path = assets / 'mahjongway/mahjongway.scene'
scene = json.loads(scene_path.read_text())
reference = json.loads((source / 'mahjongway/res/MWGameScene.scene').read_text())

# 先清除所有外部预制体/业务引用，再只提取panel2可到达的节点和原生组件。
root = next(i for i, n in enumerate(reference) if n.get('__type__') == 'cc.Node' and n.get('_name') == 'panel2')
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

# 脚本meta固定UUID；场景中挂载新控制器而非原MWOptCtrl。
script_meta = assets / 'mahjongway/src/slots/bottom_panels.ts.meta'
if not script_meta.exists():
    info = json.loads((assets / 'mahjongway/src/slots/slots_ctrl.ts.meta').read_text())
    info['uuid'] = str(uuid.uuid4())
    script_meta.write_text(json.dumps(info, indent=2) + '\n')
key = json.loads(script_meta.read_text())['uuid'].replace('-', '')
alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
class_id = key[:5] + ''.join(alphabet[int(key[i:i+3], 16) >> 6] + alphabet[int(key[i:i+3], 16) & 63] for i in range(5, 32, 3))
if not any(n.get('__type__') == 'cc.Node' and n.get('_name') == 'panel2' for n in scene):
    parent = next(i for i, n in enumerate(scene) if n.get('__type__') == 'cc.Node' and n.get('_name') == 'ctrl')
    panel1 = next(r['__id__'] for r in scene[parent]['_children'] if scene[r['__id__']].get('_name') == 'bottom')
    scene[parent]['_name'] = 'GameLayer'
    layout_id = len(scene)
    layout = copy.deepcopy(scene[panel1])
    layout['_name'] = 'layout_bottom'
    layout['_id'] = str(uuid.uuid4())
    layout['_components'] = []
    layout['_children'] = []
    scene.append(layout)
    scene[parent]['_children'] = [{'__id__': layout_id} if r['__id__'] == panel1 else r for r in scene[parent]['_children']]
    scene[panel1]['_name'] = 'panel1'
    scene[panel1]['_parent'] = {'__id__': layout_id}
    scene[panel1]['_lpos'] = {'__type__': 'cc.Vec3', 'x': 0, 'y': 0, 'z': 0}
    mapping = {old: len(scene) + i for i, old in enumerate(sorted(seen))}
    def remap(value):
        if isinstance(value, dict):
            if '__id__' in value:
                return {'__id__': mapping[value['__id__']]}
            return {k: remap(v) for k, v in value.items()}
        if isinstance(value, list):
            return [remap(v) for v in value]
        return value
    for index in sorted(seen):
        obj = remap(reference[index])
        if obj.get('__type__') == 'cc.Node':
            obj['_id'] = str(uuid.uuid4())
        scene.append(obj)
    panel2 = mapping[root]
    scene[panel2]['_parent'] = {'__id__': layout_id}
    scene[panel2]['_lpos'] = {'__type__': 'cc.Vec3', 'x': 0, 'y': 0, 'z': 0}
    layout['_children'] = [{'__id__': panel1}, {'__id__': panel2}]
    layout['_components'] = [{'__id__': len(scene)}, {'__id__': len(scene) + 1}]
    scene.append({'__type__': 'cc.UITransform', '_name': '', '_objFlags': 0, 'node': {'__id__': layout_id}, '_enabled': True, '__prefab': None, '_contentSize': {'__type__': 'cc.Size', 'width': 750, 'height': 180}, '_anchorPoint': {'__type__': 'cc.Vec2', 'x': .5, 'y': .5}, '_id': str(uuid.uuid4())})
    scene.append({'__type__': class_id, '_name': '', '_objFlags': 0, 'node': {'__id__': layout_id}, '_enabled': True, '__prefab': None, 'panel1': {'__id__': panel1}, 'panel2': {'__id__': panel2}, '_id': str(uuid.uuid4())})
    scene_path.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + '\n')
    print('Installed GameLayer/layout_bottom/panel1 and panel2')
print('Imported', len(copied), 'missing art assets')
