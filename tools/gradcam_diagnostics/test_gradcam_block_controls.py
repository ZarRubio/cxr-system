import numpy as np
import pytest
import torch

from gradcam_block_controls import evaluate_blocks


class Corner(torch.nn.Module):
    def forward(self, x):
        return x[:, :, :2, :2].sum((1, 2, 3)).unsqueeze(1)


def test_matching_geometry_reproducibility_and_input_preservation():
    model = Corner().train()
    x = torch.zeros(1, 1, 8, 8)
    x[:, :, :2, :2] = 1
    original = x.clone()
    cam = x[0, 0].numpy().copy()
    report = evaluate_blocks(model, x, cam, 0, sizes=(2,), repeats=4)
    assert model.training
    assert torch.equal(x, original)
    assert report == evaluate_blocks(model, x, cam, 0, sizes=(2,), repeats=4)
    for control in report['controls']:
        assert all((y2-y1)*(x2-x1) == 4 for y1, x1, y2, x2 in control['boxes_yxyx'])
        assert control['high_logit_drop'] > control['low_logit_drop']
    assert not report['clinical_validation']


def test_invalid_constant_cam():
    with pytest.raises(ValueError):
        evaluate_blocks(Corner(), torch.zeros(1, 1, 8, 8), np.zeros((8, 8)), 0)


def test_failure_restores_model_mode():
    model = Corner().train()
    cam = np.arange(64).reshape(8, 8)
    with pytest.raises(ValueError):
        evaluate_blocks(model, torch.zeros(1, 1, 8, 8), cam, 3, sizes=(2,))
    assert model.training
