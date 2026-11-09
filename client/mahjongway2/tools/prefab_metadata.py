"""补齐从场景提取的预制体的编辑器归属信息，不改布局或资源 UUID。"""
import uuid


def ensure_prefab_metadata(data):
    root = data[0]['data']['__id__']
    # 遍历原对象快照，避免把新增的关联对象再次当成组件处理。
    for obj in list(data):
        kind = obj.get('__type__')
        if kind == 'cc.Node':
            obj['_objFlags'] = 0
            if obj.get('_prefab') is None:
                obj['_prefab'] = {'__id__': len(data)}
                data.append({'__type__': 'cc.PrefabInfo', 'root': {'__id__': root},
                             'asset': {'__id__': 0}, 'fileId': obj.get('_id') or str(uuid.uuid4()),
                             'instance': None})
        elif obj.get('node') is not None and obj.get('__prefab') is None:
            obj['__prefab'] = {'__id__': len(data)}
            data.append({'__type__': 'cc.CompPrefabInfo',
                         'fileId': obj.get('_id') or str(uuid.uuid4())})
    return data
