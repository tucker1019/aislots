#!/usr/bin/env python3
"""Package math artifacts and initial workspace; never include credentials or live libraries."""
import argparse
import shutil
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=False)
for name in ('Dockerfile.math', 'compose.math.yaml'):
    shutil.copy2(repo / 'deploy/test' / name, out / name)
for name in ('dist', 'dist-server'):
    shutil.copytree(repo / 'slot_math' / name, out / 'payload/math' / name)
shutil.copytree(repo / 'game_configs', out / 'math-seed/game_configs')
print(out)
