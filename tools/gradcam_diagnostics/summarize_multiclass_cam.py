"""Create audit tables and readable panels without modifying any CAM values."""
import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw


def consistent(row):
    if row['status'] != 'variable':
        return False
    controls = row['controls']['controls']
    return bool(controls) and all(
        c['high_logit_drop'] > 0 and c['high_logit_drop'] > c['low_logit_drop']
        and c['high_logit_drop'] > c['random_mean_logit_drop'] for c in controls)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('root', type=Path)
    parser.add_argument('--labels', type=Path)
    args = parser.parse_args()
    report = json.loads((args.root / 'summary.json').read_text())
    labels = {r['image']: r for r in json.loads(args.labels.read_text(encoding='utf-8-sig'))} if args.labels else {}
    groups = defaultdict(list)
    for row in report['cases']:
        groups[(row['target_class'], row['method'])].append(row)
    counts = []
    for (target, method), rows in sorted(groups.items()):
        counts.append({'class': target, 'method': method, 'total': len(rows),
                       'variable': sum(r['status'] == 'variable' for r in rows),
                       'consistent': sum(consistent(r) for r in rows),
                       'label_positive': sum(str(labels.get(r['image'], {}).get(target)) == '1' for r in rows),
                       'positive_consistent': sum(consistent(r) and str(labels.get(r['image'], {}).get(target)) == '1' for r in rows)})
    with (args.root / 'counts.csv').open('w', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=list(counts[0]))
        writer.writeheader()
        writer.writerows(counts)
    (args.root / 'counts.json').write_text(json.dumps(counts, indent=2))
    # Every case is shown, including empty maps. No post-hoc visual selection.
    for target in report['protocol']['targets']:
        images = sorted({row['image'] for row in report['cases'] if row['target_class'] == target})
        methods = report['protocol']['variants']
        canvas = Image.new('RGB', (224*len(methods), 264*len(images)), 'white')
        draw = ImageDraw.Draw(canvas)
        for y, name in enumerate(images):
            for x, method in enumerate(methods):
                path = args.root / Path(name).stem / target / method
                row = json.loads((path / 'report.json').read_text())
                canvas.paste(Image.open(path / 'overlay.png'), (224*x, 264*y+40))
                label = f'{name}\n{method}\n' + ('control passes' if consistent(row) else row['status'])
                draw.multiline_text((224*x+4, 264*y+2), label, fill='black', spacing=0)
        canvas.save(args.root / f'panel_{target}.png')
    image_names = report['protocol']['images']
    patients = len({name.split('_')[0] for name in image_names})
    lines = ['# Exploratory multiclass CAM comparison', '',
             f'{len(image_names)} images, {patients} distinct filename patient prefixes; {len(report["protocol"]["targets"])} prespecified classes.',
             'These are not lesion-localization or clinical accuracy scores.',
             ('NIH labels were linked from the provided metadata. Legacy model exposure remains unverified; not an independent test.'
              if labels else 'Labels and split membership are unverified.'),
             'All cases remain in the denominator, including uninterpretable maps.', '',
             '| Class | Method | Variable / total | Control passes / total |',
             '| --- | --- | --- | --- |']
    for row in counts:
        lines.append(f"| {row['class']} | {row['method']} | {row['variable']}/{row['total']} | {row['consistent']}/{row['total']} |")
    lines.extend(['', 'Controls: ' + report['protocol'].get('occlusion', 'See protocol.json') + '; base seed 42.',
                  'Pass: positive output drop larger than both the low-attribution drop and the random mean.',
                  'When several controls are specified, all must pass; no best-condition selection.',
                  'No statistical significance or generalization claim. Do not tune methods on these cases to reach 9/10.',
                  'Output units differ: ensemble score versus v2 logit. Do not compare drop magnitudes across these outputs.',
                  'Next: frozen labeled patient-disjoint validation and multiple block sizes/fills, followed by an independent localization evaluation.'])
    if labels:
        lines.extend(['', '## NIH label-positive subset (same controls, not a new clinical validation)',
                      '| Class | Method | Positive control passes / positive cases |', '| --- | --- | --- |'])
        for row in counts:
            lines.append(f"| {row['class']} | {row['method']} | {row['positive_consistent']}/{row['label_positive']} |")
        lines.append('A zero positive denominator means no positive cases, not zero diagnostic accuracy. NIH labels may be noisy; no lesion masks were provided.')
    (args.root / 'RESULTADOS.md').write_text('\n'.join(lines))
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
