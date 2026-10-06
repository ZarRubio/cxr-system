import base64
import io
from types import SimpleNamespace

import numpy as np
import pytest
import torch
from PIL import Image

from services import gradcam_service
from services.cam_fidelity import evaluate_occlusion


def decode(uri):
    return np.asarray(Image.open(io.BytesIO(base64.b64decode(uri.split(',')[1]))))


def test_pure_map_does_not_contain_radiograph(monkeypatch):
    calls = []
    class FakeCAM:
        def __init__(self, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def __call__(self, **kwargs):
            calls.append(kwargs)
            return np.linspace(0, 1, 224 * 224).reshape(1, 224, 224)
    monkeypatch.setattr(gradcam_service, 'GradCAM', FakeCAM)
    model = SimpleNamespace(cnn_features=SimpleNamespace(denseblock4=object()))
    tensor = torch.zeros(1, 1, 224, 224)
    first = gradcam_service.generate_gradcam_layers(model, tensor, np.zeros((224, 224), dtype=np.uint8), 2)
    second = gradcam_service.generate_gradcam_layers(model, tensor, np.full((224, 224), 255, dtype=np.uint8), 2)
    assert len(calls) == 2  # One CAM pass per request, not one per output image.
    assert np.array_equal(decode(first[1]), decode(second[1]))
    assert not np.array_equal(decode(first[0]), decode(second[0]))
    assert decode(first[1]).shape == (224, 224, 3)


class CornerModel(torch.nn.Module):
    def forward(self, x):
        return x[:, :, :1, :1].sum(dim=(1, 2, 3)).unsqueeze(1)


def test_occlusion_detects_known_dependency_and_restores_mode():
    model = CornerModel().train()
    tensor = torch.zeros(1, 1, 4, 4)
    tensor[0, 0, 0, 0] = 1
    cam = np.zeros((4, 4))
    cam[0, 0] = 1
    report = evaluate_occlusion(model, tensor, cam, 0, repeats=10)
    assert model.training
    assert report['high_attribution_logit_drop'] > report['random_mean_logit_drop']
    assert report['low_attribution_logit_drop'] == 0
    assert report == evaluate_occlusion(model, tensor, cam, 0, repeats=10)
    assert report['clinical_validation'] is False


def test_constant_cam_is_not_presented_as_evidence():
    with pytest.raises(ValueError, match='constant'):
        evaluate_occlusion(CornerModel(), torch.zeros(1, 1, 4, 4), np.zeros((4, 4)), 0)


@pytest.mark.parametrize('value', [0.0, 1.0, float('nan'), float('inf')])
def test_uninterpretable_cam_has_no_encoded_map(monkeypatch, value):
    class FakeCAM:
        def __init__(self, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def __call__(self, **kwargs):
            return np.full((1, 224, 224), value)
    monkeypatch.setattr(gradcam_service, 'GradCAM', FakeCAM)
    model = SimpleNamespace(cnn_features=SimpleNamespace(denseblock4=object()))
    assert gradcam_service.generate_gradcam_layers(
        model, torch.zeros(1, 1, 224, 224), np.zeros((224, 224), dtype=np.uint8), 0
    ) == ('', '')
