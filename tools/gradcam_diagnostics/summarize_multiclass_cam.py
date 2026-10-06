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
    control = row['controls']['controls'][0]
    high = control['high_logit_drop']
    return high > 0 and high > control['low_logit_drop'] and high > control['random_mean_logit_drop']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('root', type=Path)
    args = parser.parse_args()
    report = json.loads((args.root / 'summary.json').read_text())
    groups = defaultdict(list)
    for row in report['cases']:
        groups[(row['target_class'], row['method'])].append(row)
    counts = []
    for (target, method), rows in sorted(groups.items()):
        counts.append({'class': target, 'method': method, 'total': len(rows),
                       'variable': sum(r['status'] == 'variable' for r in rows),
                       'consistent': sum(consistent(r) for r in rows)})
    with (args.root / 'counts.csv').open('w', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=['class', 'method', 'total', 'variable', 'consistent'])
        writer.writeheader()
        writer.writerows(counts)
    (args.root / 'counts.json').write_text(json.dumps(counts, indent=2))
    # Every case is shown, including empty maps. No post-hoc visual selection.
    for target in report['protocol']['targets']:
        images = report['protocol']['images']
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
    lines = ['# Exploratory multiclass CAM comparison', '',
             'Ten additional patients selected before evaluation; four prespecified classes.',
             'Labels and split membership are unverified. These are not lesion-localization or clinical accuracy scores.',
             'All cases remain in the denominator, including uninterpretable maps.', '',
             '| Class | Method | Variable / total | Control passes / total |',
             '| --- | --- | --- | --- |']
    for row in counts:
        lines.append(f"| {row['class']} | {row['method']} | {row['variable']}/{row['total']} | {row['consistent']}/{row['total']} |")
    lines.extend(['', 'Control: 32x32 Gaussian blur, twenty random blocks, seed 42.',
                  'Pass: positive output drop larger than both the low-attribution drop and the random mean.',
                  'No statistical significance or generalization claim. Do not tune methods on these cases to reach 9/10.',
                  'Output units differ: ensemble score versus v2 logit. Do not compare drop magnitudes across these outputs.',
                  'Next: frozen labeled patient-disjoint validation and multiple block sizes/fills, followed by an independent localization evaluation.'])
    (args.root / 'RESULTADOS.md').write_text('\n'.join(lines))
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
