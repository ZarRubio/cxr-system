import base64
import io
from unittest.mock import patch
from types import SimpleNamespace

import numpy as np
from PIL import Image

from services.prediction_service import PredictOptions, _run_prediction, _build_response_data


def test_gradcam_targets_primary_finding_not_list_order():
    result = {"predicted_class": "Effusion", "positive_findings": ["Atelectasis", "Effusion"]}
    with patch("services.prediction_service.run_ensemble_inference", return_value=result), patch("services.prediction_service.generate_gradcam", return_value="cam") as cam:
        _, _, target = _run_prediction({"model_v2": object()}, np.zeros((224, 224), dtype=np.uint8), PredictOptions())
    assert target == "Effusion"
    assert cam.call_args.args[3] == 4


def test_decoded_preview_is_png():
    result = {"predicted_class": "No Finding", "predicted_label": -1, "confidence": 0.5, "probabilities": {}, "positive_findings": [], "sub_threshold_findings": [], "decision_support": {}}
    with patch("services.prediction_service.image_warnings", return_value=[]):
        data = _build_response_data(result, np.arange(256, dtype=np.uint8).reshape(16, 16), SimpleNamespace(response_data=lambda: {}), "hash", "cam", "Effusion", 10)
    raw = base64.b64decode(data["image_preview"].split(",")[1])
    image = Image.open(io.BytesIO(raw))
    assert image.format == "PNG"
    assert image.size == (224, 224)
