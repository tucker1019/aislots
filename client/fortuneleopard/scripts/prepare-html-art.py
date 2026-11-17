"""Package HTML history/rules art from the original 1021 game resources."""
import base64
import io
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/resources/res/image/games'
SYMBOLS = {1: 'juzi', 2: 'pao', 3: 'hongbao', 4: 'fudai', 5: 'ruyi', 6: 'yuanbao', 7: 'wild'}
art = {}
buffer = io.BytesIO()
Image.new('RGBA', (1, 1)).save(buffer, format='PNG')
art['0'] = 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()
for symbol, name in SYMBOLS.items():
    art[str(symbol)] = 'data:image/png;base64,' + base64.b64encode((SOURCE / f'symbol/{name}.png').read_bytes()).decode()
history = ROOT / 'assets/resources/history'
history.mkdir(parents=True, exist_ok=True)
(history / 'art.json').write_text(json.dumps(art) + '\n')
# Keep the illustrations only; the HTML renders Indonesian headings and rules.
illustrations = {
    'paytable_features.png': ('help2.png', (65, 55, 605, 680)),
    'paytable_multiplier_feature.png': ('help3.png', (80, 270, 675, 805)),
    'paytable_payline.png': ('help4.png', (0, 55, 680, 265)),
}
for template in ['preview-template', 'build-templates/web-mobile']:
    target = ROOT / template / 'rules'
    target.mkdir(parents=True, exist_ok=True)
    for name in SYMBOLS.values():
        (target / f'{name}.png').write_bytes((SOURCE / f'symbol/{name}.png').read_bytes())
    for name, (source, bounds) in illustrations.items():
        Image.open(SOURCE / 'help/en' / source).crop(bounds).save(target / name, optimize=True)
