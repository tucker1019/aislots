"""展开原场景嵌套的视觉 Prefab，先应用实例覆盖，再交给原生组件提取流程。"""
import copy
import json


def expand_instances(scene, root, source_index):
    def remap(value, mapping):
        if isinstance(value, dict):
            if '__id__' in value:
                return {'__id__': mapping[value['__id__']]}
            return {k: remap(v, mapping) for k, v in value.items()}
        if isinstance(value, list):
            return [remap(v, mapping) for v in value]
        return value

    def expand(index):
        node = scene[index]
        info = scene[node['_prefab']['__id__']] if node.get('_prefab') else {}
        asset = info.get('asset', {}).get('__uuid__')
        if asset:
            original = source_index.get(asset)
            if not original or original.suffix != '.prefab':
                raise ValueError('Missing nested visual prefab: ' + asset)
            data = json.loads(original.read_text())
            prefab_root = data[0]['data']['__id__']
            targets = {}
            for obj in data:
                link = obj.get('_prefab') or obj.get('__prefab')
                if link:
                    targets[data[link['__id__']]['fileId']] = obj
            instance = scene[info['instance']['__id__']] if info.get('instance') else {}
            if instance.get('mountedChildren') or instance.get('mountedComponents'):
                raise ValueError('Mounted prefab content needs explicit support')
            for ref in instance.get('propertyOverrides', []):
                override = scene[ref['__id__']]
                ids = scene[override['targetInfo']['__id__']]['localID']
                if len(ids) != 1 or ids[0] not in targets:
                    raise ValueError('Unresolved prefab override target: ' + str(ids))
                target = targets[ids[0]]
                keys = override['propertyPath']
                for key in keys[:-1]:
                    target = target[key]
                target[keys[-1]] = copy.deepcopy(override['value'])
            # Keep the original scene parent. All prefab-internal references get
            # new scene indices, so the five instances do not share any nodes.
            parent = copy.deepcopy(node.get('_parent'))
            mapping = {prefab_root: index}
            for old in range(len(data)):
                if old != prefab_root:
                    mapping[old] = len(scene)
                    scene.append(None)
            for old, obj in enumerate(data):
                scene[mapping[old]] = remap(obj, mapping)
            node = scene[index]
            node['_parent'] = parent
        for ref in node.get('_children', []):
            expand(ref['__id__'])

    expand(root)
