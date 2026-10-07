"""Copy verified frozen-cohort originals; never replace missing or resized files."""
import argparse
import csv
import hashlib
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path

from PIL import Image


def materialize(cohort, images_root, output):
    if output.exists() or not images_root.is_dir():
        raise ValueError('Use a valid image root and new output directory')
    protocol = json.loads((cohort / 'protocol.json').read_text())
    selection = cohort / 'selection.private.csv'
    if hashlib.sha256(selection.read_bytes()).hexdigest() != protocol['selection_sha256']:
        raise ValueError('Frozen selection hash mismatch')
    with selection.open(newline='', encoding='utf-8') as source:
        cases = list(csv.DictReader(source))
    names = {row['image'] for row in cases}
    if not names or any(not re.fullmatch(r'\d{8}_\d+\.png', name) for name in names):
        raise ValueError('Invalid selection filenames')
    located = defaultdict(list)
    for path in images_root.rglob('*.png'):
        if path.name in names:
            located[path.name].append(path)
    missing = sorted(names - located.keys())
    ambiguous = sorted(name for name, paths in located.items() if len(paths) != 1)
    if missing or ambiguous:
        raise ValueError(json.dumps({'missing': missing, 'ambiguous': ambiguous}))
    audit = []
    for name in sorted(names):
        path = located[name][0]
        with Image.open(path) as image:
            if image.format != 'PNG' or min(image.size) < 1024:
                raise ValueError(f'Original-resolution PNG required: {name}, {image.size}')
            image.verify()
        audit.append({'image': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    (output / 'images').mkdir(parents=True)
    for name in sorted(names):
        shutil.copyfile(located[name][0], output / 'images' / name)
    for name in ('protocol.json', 'selection.private.csv', 'labels.private.json'):
        shutil.copyfile(cohort / name, output / name)
    (output / 'image_audit.private.json').write_text(json.dumps({
        'images': audit, 'selection_sha256': protocol['selection_sha256'],
        'provenance_limit': 'Filename and dimensions do not independently prove NIH image provenance',
        'lesion_annotations_available': False}, indent=2))
    return len(audit)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cohort', type=Path, required=True)
    parser.add_argument('--images-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps({'copied_originals': materialize(args.cohort, args.images_root, args.output)}))


if __name__ == '__main__':
    main()
