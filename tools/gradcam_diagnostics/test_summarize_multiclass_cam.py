import json
import sys

from PIL import Image

from summarize_multiclass_cam import consistent, main


def test_every_prespecified_control_must_pass():
    good = {'high_logit_drop': .3, 'low_logit_drop': .1, 'random_mean_logit_drop': .2}
    bad = dict(good, high_logit_drop=.05)
    assert consistent({'status': 'variable', 'controls': {'controls': [good, good]}})
    assert not consistent({'status': 'variable', 'controls': {'controls': [good, bad]}})


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


def test_targets_without_cases_and_missing_overlays_do_not_crash(tmp_path, monkeypatch):
    row = {'image': '00000001_000.png', 'target_class': 'Effusion', 'method': 'method',
           'status': 'not_interpretable', 'controls': None}
    protocol = {'images': [row['image']], 'variants': ['method'], 'targets': ['Effusion', 'Pneumonia']}
    (tmp_path / 'summary.json').write_text(json.dumps({'protocol': protocol, 'cases': [row]}))
    folder = tmp_path / '00000001_000' / 'Effusion' / 'method'
    folder.mkdir(parents=True)
    (folder / 'report.json').write_text(json.dumps(row))
    monkeypatch.setattr(sys, 'argv', ['summarize', str(tmp_path)])
    main()
    assert (tmp_path / 'panel_Effusion.png').exists()
    assert not (tmp_path / 'panel_Pneumonia.png').exists()
    assert (tmp_path / 'RESULTADOS.md').exists()
