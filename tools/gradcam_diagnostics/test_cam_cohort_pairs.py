import hashlib

import pytest

from compare_cam_methods import case_pairs


def test_frozen_pairs_do_not_cross_every_image_with_every_class(tmp_path):
    files = [tmp_path / 'a.png', tmp_path / 'b.png']
    cohort = tmp_path / 'selection.csv'
    cohort.write_text('image,target_class,split\na.png,Effusion,val\nb.png,Emphysema,val\n')
    protocol = {'selection_sha256': hashlib.sha256(cohort.read_bytes()).hexdigest()}
    result = case_pairs(files, ['Effusion', 'Emphysema'], cohort, protocol)
    assert result == [(files[0], 'Effusion'), (files[1], 'Emphysema')]
    assert len(case_pairs(files, ['Effusion', 'Emphysema'])) == 4
    with pytest.raises(ValueError, match='exactly'):
        case_pairs(files[:1], ['Effusion', 'Emphysema'], cohort, protocol)
    cohort.write_text(cohort.read_text().replace('val', 'test'))
    with pytest.raises(ValueError, match='hash'):
        case_pairs(files, ['Effusion', 'Emphysema'], cohort, protocol)
