import csv
import hashlib
import json

import pytest
from PIL import Image

from materialize_cam_cohort import materialize


def cohort(root):
    root.mkdir()
    with (root / 'selection.private.csv').open('w', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=['image'])
        writer.writeheader()
        writer.writerow({'image': '00000001_000.png'})
    digest = hashlib.sha256((root / 'selection.private.csv').read_bytes()).hexdigest()
    (root / 'protocol.json').write_text(json.dumps({'selection_sha256': digest}))
    (root / 'labels.private.json').write_text('[]')


def test_missing_and_resized_images_fail_without_output(tmp_path):
    selected, source, output = tmp_path / 'cohort', tmp_path / 'source', tmp_path / 'out'
    cohort(selected)
    source.mkdir()
    with pytest.raises(ValueError, match='missing'):
        materialize(selected, source, output)
    Image.new('L', (224, 224)).save(source / '00000001_000.png')
    with pytest.raises(ValueError, match='resolution'):
        materialize(selected, source, output)
    assert not output.exists()


def test_originals_are_copied_without_pixel_changes(tmp_path):
    selected, source, output = tmp_path / 'cohort', tmp_path / 'source', tmp_path / 'out'
    cohort(selected)
    source.mkdir()
    original = source / '00000001_000.png'
    Image.new('L', (1024, 1024), 120).save(original)
    assert materialize(selected, source, output) == 1
    assert original.read_bytes() == (output / 'images' / original.name).read_bytes()
    with pytest.raises(ValueError, match='new output'):
        materialize(selected, source, output)
