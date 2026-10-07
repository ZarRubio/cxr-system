import json
import sys

from PIL import Image

from summarize_multiclass_cam import main


def test_report_keeps_uninterpretable_cases_and_label_denominators(tmp_path, monkeypatch):
    rows = [
        {'image': '00000001_000.png', 'target_class': 'Effusion', 'method': 'method',
         'status': 'variable', 'controls': {'controls': [{'high_logit_drop': .3,
         'low_logit_drop': .1, 'random_mean_logit_drop': .2}]}},
        {'image': '00000002_000.png', 'target_class': 'Effusion', 'method': 'method',
         'status': 'not_interpretable', 'controls': None},
    ]
    protocol = {'images': [r['image'] for r in rows], 'variants': ['method'], 'targets': ['Effusion']}
    (tmp_path / 'summary.json').write_text(json.dumps({'protocol': protocol, 'cases': rows}))
    labels = tmp_path / 'labels.json'
    labels.write_text(json.dumps([{'image': r['image'], 'Effusion': '1'} for r in rows]))
    for row in rows:
        folder = tmp_path / row['image'].removesuffix('.png') / 'Effusion' / 'method'
        folder.mkdir(parents=True)
        (folder / 'report.json').write_text(json.dumps(row))
        Image.new('RGB', (224, 224), 'white').save(folder / 'overlay.png')
    monkeypatch.setattr(sys, 'argv', ['summarize', str(tmp_path), '--labels', str(labels)])
    main()
    count = json.loads((tmp_path / 'counts.json').read_text())[0]
    assert count['total'] == count['label_positive'] == 2
    assert count['consistent'] == count['variable'] == count['positive_consistent'] == 1
    report = (tmp_path / 'RESULTADOS.md').read_text()
    assert '2 images, 2 distinct' in report
    assert 'not an independent test' in report
