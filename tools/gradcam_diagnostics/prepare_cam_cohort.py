"""Freeze a balanced validation-only CAM cohort without selecting on model output."""
import argparse
import csv
import hashlib
import json
import random
import re
from pathlib import Path

DEFAULT_CLASSES = ('Emphysema', 'Effusion', 'Cardiomegaly', 'Mass')


def select_cases(rows, classes, per_group, seed, excluded=()):
    if per_group < 1 or not classes or len(classes) != len(set(classes)):
        raise ValueError('Invalid class list or group size')
    seen_images = set()
    for row in rows:
        match = re.fullmatch(r'(\d{8})_\d+\.png', row['Image Index'])
        if not match or match[1] != row['Patient ID'] or row['Image Index'] in seen_images:
            raise ValueError('Invalid filename/patient mapping or duplicate image')
        seen_images.add(row['Image Index'])
        for name in classes:
            if row.get(name) not in ('0', '1'):
                raise ValueError('Expected binary class columns')
            if (row[name] == '1') != (name in row['Finding Labels'].split('|')):
                raise ValueError('Binary class and finding labels disagree')
    rng = random.Random(seed)
    used = set(excluded)
    selected = []
    # Select positives first so the broad negative pool cannot exhaust rare cases.
    for label in ('1', '0'):
        for name in classes:
            candidates = sorted((r for r in rows if r[name] == label), key=lambda r: r['Image Index'])
            rng.shuffle(candidates)
            count = 0
            for row in candidates:
                patient = row['Patient ID']
                if patient in used:
                    continue
                used.add(patient)
                selected.append({'image': row['Image Index'], 'patient': patient,
                                 'target_class': name, 'target_positive': int(label),
                                 'finding_labels': row['Finding Labels'], 'view': row['View Position'],
                                 'split': 'val'})
                count += 1
                if count == per_group:
                    break
            if count != per_group:
                raise ValueError(f'Insufficient distinct patients for {name} label={label}')
    return selected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--val', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--classes', nargs='+', default=list(DEFAULT_CLASSES))
    parser.add_argument('--per-group', type=int, default=10)
    parser.add_argument('--seed', type=int, default=20261007)
    parser.add_argument('--exclude-patients', nargs='*', default=[])
    args = parser.parse_args()
    if args.val.name != 'val.csv' or args.output.exists():
        raise ValueError('Use val.csv and a new output directory; never select from test')
    raw = args.val.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    source_manifest = json.loads(args.manifest.read_text())
    if digest != source_manifest['split_sha256']['val']:
        raise ValueError('Validation CSV hash does not match split manifest')
    with args.val.open(encoding='utf-8-sig', newline='') as source:
        rows = list(csv.DictReader(source))
    cases = select_cases(rows, args.classes, args.per_group, args.seed, args.exclude_patients)
    args.output.mkdir(parents=True)
    with (args.output / 'selection.private.csv').open('w', newline='', encoding='utf-8') as output:
        writer = csv.DictWriter(output, fieldnames=list(cases[0]))
        writer.writeheader()
        writer.writerows(cases)
    labels = {r['Image Index']: r for r in rows}
    (args.output / 'labels.private.json').write_text(json.dumps([
        dict(image=c['image'], **{name: labels[c['image']][name] for name in args.classes})
        for c in cases], indent=2))
    selection_hash = hashlib.sha256((args.output / 'selection.private.csv').read_bytes()).hexdigest()
    protocol = {'status': 'frozen_exploratory_validation_cohort', 'split': 'val',
                'val_sha256': digest, 'selection_sha256': selection_hash, 'seed': args.seed,
                'classes': args.classes, 'per_class_positive': args.per_group,
                'per_class_negative': args.per_group, 'images': len(cases),
                'distinct_patients': len({c['patient'] for c in cases}),
                'excluded_patients': args.exclude_patients,
                'selection_uses_predictions': False, 'lesion_annotations_available': False,
                'legacy_checkpoints_eligible_for_independent_test': source_manifest.get(
                    'legacy_checkpoints_eligible_for_independent_test', False),
                'limits': ['Validation-only; no test selection or tuning',
                           'NIH labels are not lesion annotations or confirmed clinical diagnoses',
                           'Historical weights are not made independent by a new split',
                           'Do not replace missing originals with convenient cases or reconstructed images']}
    (args.output / 'protocol.json').write_text(json.dumps(protocol, indent=2))
    print(json.dumps({'images': len(cases), 'patients': protocol['distinct_patients'],
                      'selection_sha256': selection_hash, 'lesion_annotations_available': False}, indent=2))


if __name__ == '__main__':
    main()
