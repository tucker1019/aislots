"""同步独立 Web Audio 的静态 MP3，预览和 web-mobile 构建使用相同文件。"""
from pathlib import Path
import argparse
import shutil
import json
import hashlib
import re

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
    # A reference with bgm_fs must not leave the old first-game free BGM behind.
    if (source / 'bgm_fs.mp3').exists() and not (source / 'bgm_bonus_loop.mp3').exists():
        old = destination / 'bgm_bonus_loop.mp3'
        if old.exists(): old.unlink()
if source != (root / 'preview-template/audio').resolve():
    project = next((p.parent.name for p in source.parents if p.name == 'assets'), source.name)
    manifest = {'source': project, 'files': {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}}
    (root / 'tools/audio_reference_manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
hashes = {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
revision = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()[:12]
script = root / 'assets/mahjongway2/src/audio/web_audio.ts'
text = script.read_text()
text, matches = re.subn(r"const AUDIO_REVISION = '[^']+';", f"const AUDIO_REVISION = '{revision}';", text)
if matches != 1: raise SystemExit('Audio revision marker missing')
script.write_text(text)
print(f'Synced {len(files)} audio files for preview and web-mobile')
