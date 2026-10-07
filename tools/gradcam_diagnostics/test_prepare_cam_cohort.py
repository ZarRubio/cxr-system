import pytest

from prepare_cam_cohort import select_cases


def rows():
    output = []
    for index in range(1, 41):
        labels = 'Effusion' if index <= 20 else 'No Finding'
        output.append({'Image Index': f'{index:08d}_000.png', 'Patient ID': f'{index:08d}',
                       'Finding Labels': labels, 'View Position': 'PA',
                       'Effusion': '1' if index <= 20 else '0'})
    return output


def test_balanced_deterministic_patient_disjoint_selection():
    result = select_cases(rows(), ['Effusion'], 5, 42, ['00000001'])
    assert result == select_cases(list(reversed(rows())), ['Effusion'], 5, 42, ['00000001'])
    assert len(result) == len({r['patient'] for r in result}) == 10
    assert sum(r['target_positive'] for r in result) == 5
    assert all(r['patient'] != '00000001' and r['split'] == 'val' for r in result)


def test_insufficient_patients_fail_without_substituting_cases():
    with pytest.raises(ValueError, match='Insufficient'):
        select_cases(rows()[:3], ['Effusion'], 5, 42)


def test_inconsistent_labels_and_patient_mapping_are_rejected():
    sample = rows()
    sample[0]['Effusion'] = '0'
    with pytest.raises(ValueError, match='disagree'):
        select_cases(sample, ['Effusion'], 5, 42)
    sample = rows()
    sample[0]['Patient ID'] = '00000002'
    with pytest.raises(ValueError, match='mapping'):
        select_cases(sample, ['Effusion'], 5, 42)
