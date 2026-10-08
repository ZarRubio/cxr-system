import numpy as np
import pytest
import torch
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

from cam_diagnostics import DiagnosticGradCAM, EnsembleScore, EnsembleGradCAM, EnsembleHiResCAM, patch_tokens_to_grid


class Toy(torch.nn.Module):
    def __init__(self, sign=1):
        super().__init__()
        self.features = torch.nn.Conv2d(1, 1, 1, bias=False)
        torch.nn.init.ones_(self.features.weight)
        self.sign = sign

    def forward(self, x):
        return 20 + self.sign * self.features(x).mean((2, 3))


def test_negative_contributions_can_produce_empty_cam_with_nonzero_gradients():
    model = Toy(-1).eval()
    x = torch.arange(1, 17).float().reshape(1, 1, 4, 4)
    with DiagnosticGradCAM(model, [model.features]) as cam:
        image = cam(x, targets=[ClassifierOutputTarget(0)])
        assert cam.layer_diagnostics[0]['gradient_l2'] > 0
        assert cam.layer_diagnostics[0]['raw_max'] < 0
        assert np.max(image) == 0
        assert float(torch.sigmoid(model(x)[0, 0]).detach()) > .99


def test_ensemble_score_and_gradients_match_manual_expression():
    v1, v2 = Toy(-1), Toy(1)
    wrapper = EnsembleScore(v1, v2, .3, .7, temperature=2)
    x = torch.ones(1, 1, 4, 4, requires_grad=True)
    expected = .3*torch.sigmoid(v1(x)/2) + .7*torch.sigmoid(v2(x)/2)
    assert torch.allclose(wrapper(x), expected)
    expected_gradient = torch.autograd.grad(expected.sum(), x)[0]
    actual_gradient = torch.autograd.grad(wrapper(x).sum(), x)[0]
    assert torch.allclose(expected_gradient, actual_gradient)


@pytest.mark.parametrize('method', [EnsembleGradCAM, EnsembleHiResCAM])
def test_ensemble_cam_sums_raw_maps_before_rectification(method):
    v1, v2 = Toy(-1), Toy(1)
    wrapper = EnsembleScore(v1, v2, .3, .7)
    x = torch.arange(1, 17).float().reshape(1, 1, 4, 4)
    with method(wrapper, [v1.features, v2.features]) as cam:
        result = cam(x, targets=[ClassifierOutputTarget(0)])
        assert np.allclose(cam.combined_raw, sum(cam.raw_maps))
        assert result.shape == (1, 4, 4)
        assert len(cam.layer_diagnostics) == 2


def test_patch_grid_excludes_cls_and_checks_shape():
    tokens = torch.arange(50*8).reshape(1, 50, 8)
    grid = patch_tokens_to_grid(tokens)
    assert grid.shape == (1, 8, 7, 7)
    assert torch.equal(grid[0, :, 0, 0], tokens[0, 1])
    with pytest.raises(ValueError):
        patch_tokens_to_grid(torch.ones(1, 7, 8))


def test_ensemble_hirescam_preserves_spatial_gradient_contributions():
    class SpatialToy(Toy):
        def forward(self, x):
            features = self.features(x)
            weights = torch.arange(1, 17, device=x.device).reshape(1, 1, 4, 4)
            return self.sign * (features * weights).mean((2, 3))
    v1, v2 = SpatialToy(1), SpatialToy(-1)
    wrapper = EnsembleScore(v1, v2, .3, .7)
    x = torch.linspace(.01, .16, 16).reshape(1, 1, 4, 4).requires_grad_()
    gradient = torch.autograd.grad(wrapper(x).sum(), x)[0]
    expected = (x * gradient).detach().numpy()[:, 0]
    with EnsembleHiResCAM(wrapper, [v1.features, v2.features]) as cam:
        cam(x, targets=[ClassifierOutputTarget(0)])
        assert np.allclose(cam.combined_raw, expected, atol=1e-7)
