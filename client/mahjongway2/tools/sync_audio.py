"""同步独立 Web Audio 的静态 MP3，预览和 web-mobile 构建使用相同文件。"""
from pathlib import Path
import argparse
import shutil

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=root / 'preview-template/audio')
args = parser.parse_args()
source = args.source.resolve()
files = list(source.rglob('*.mp3'))
if not files:
    raise SystemExit(f'没有 MP3 文件：{source}')
for destination in [root / 'preview-template/audio', root / 'build-templates/web-mobile/audio']:
    for file in files:
        target = destination / file.relative_to(source)
        if target.resolve() == file.resolve():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, target)
print(f'Synced {len(files)} audio files for preview and web-mobile')
