"""
Unit and integration tests for the CXR Classification backend.

Coverage:
  - utils.image_utils  : detect_format, preprocess_for_model, validate_source_channels
  - services.dicom_service  : extract_pixels_from_dicom
  - services.model_service  : run_ensemble_inference (14-class ensemble)
  - services.prediction_service : validate_file_size, image_warnings
  - routers.predict helpers : _parse_gradcam_method
  - API endpoints           : /health, /model-info, /predict, /predict-batch
"""

import io
import os
import sys
from pathlib import Path

os.environ["CXR_SKIP_MODEL_LOAD"] = "1"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import pytest
import torch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, SecondaryCaptureImageStorage, generate_uid

from main import app
from routers.predict import _parse_gradcam_method
from services.dicom_service import extract_pixels_from_dicom
from services.model_service import CLASSES_14, run_ensemble_inference
from services.prediction_service import image_warnings, validate_file_size
from utils.cache import LRUCache
from utils.image_utils import detect_format, preprocess_for_model, validate_source_channels

# ──────────────────────────────────────────────────────────────────────────────
# Mock helpers
# ──────────────────────────────────────────────────────────────────────────────

THRESHOLDS_14 = {cls: 0.3 for cls in CLASSES_14}

# Effusion is at index 4 in CLASSES_14
_EFFUSION_IDX = CLASSES_14.index("Effusion")


class _ConstantLogitModel(torch.nn.Module):
    """Returns the same fixed logit vector (shape 1×14) for any input."""

    def __init__(self, logits: list):
        super().__init__()
        self._logits = torch.tensor([logits], dtype=torch.float32)

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        return self._logits


def _low_logits() -> list:
    """All classes well below threshold (sigmoid ≈ 0.007 each)."""
    return [-5.0] * 14


def _effusion_logits() -> list:
    """Only Effusion is above threshold (sigmoid ≈ 0.953)."""
    logits = [-5.0] * 14
    logits[_EFFUSION_IDX] = 3.0
    return logits


def _make_ensemble(logits_v1: list, logits_v2: list, w1: float = 0.5, w2: float = 0.5) -> dict:
    return {
        "model_v1": _ConstantLogitModel(logits_v1),
        "model_v2": _ConstantLogitModel(logits_v2),
        "weight_v1": w1,
        "weight_v2": w2,
        "thresholds": THRESHOLDS_14,
        "device": torch.device("cpu"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Image byte factories
# ──────────────────────────────────────────────────────────────────────────────

def _make_png_bytes(width: int = 224, height: int = 224) -> bytes:
    arr = np.random.randint(30, 200, (height, width), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, mode="L").save(buf, format="PNG")
    return buf.getvalue()


def _make_jpg_bytes(width: int = 224, height: int = 224) -> bytes:
    arr = np.random.randint(30, 200, (height, width), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, mode="L").save(buf, format="JPEG")
    return buf.getvalue()


def _make_cmyk_jpg_bytes(width: int = 224, height: int = 224) -> bytes:
    buf = io.BytesIO()
    Image.new("CMYK", (width, height), (0, 128, 128, 0)).save(buf, format="JPEG")
    return buf.getvalue()


def _make_dicom_bytes(photometric: str = "MONOCHROME2") -> bytes:
    pixel_data = np.array([[0, 1000], [250, 750]], dtype=np.uint16)

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = SecondaryCaptureImageStorage
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = generate_uid()

    ds = FileDataset(None, {}, file_meta=file_meta, preamble=b"\0" * 128)
    ds.is_little_endian = True
    ds.is_implicit_VR = False
    ds.Rows, ds.Columns = pixel_data.shape
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = photometric
    ds.BitsAllocated = ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    ds.RescaleSlope = 2
    ds.RescaleIntercept = -100
    ds.WindowCenter = 900
    ds.WindowWidth = 1800
    ds.PixelData = pixel_data.tobytes()

    buf = io.BytesIO()
    ds.save_as(buf, write_like_original=False)
    return buf.getvalue()


# ──────────────────────────────────────────────────────────────────────────────
# Client fixture
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(
        "services.prediction_service.generate_gradcam",
        lambda model, tensor, img_array, label, method="gradcam": "data:image/png;base64,ZmFrZQ==",
    )
    with TestClient(app) as c:
        app.state.ensemble = _make_ensemble(_effusion_logits(), _effusion_logits())
        app.state.prediction_cache = LRUCache(maxsize=20)
        yield c


# ══════════════════════════════════════════════════════════════════════════════
# 1. detect_format
# ══════════════════════════════════════════════════════════════════════════════

class TestDetectFormat:
    def test_png_magic_bytes_override_extension(self):
        assert detect_format(b"\x89PNG\r\n\x1a\nrest", "image.jpg") == "png"

    def test_jpg_magic_bytes_override_extension(self):
        assert detect_format(b"\xff\xd8rest", "image.png") == "jpg"

    def test_dicom_magic_bytes(self):
        assert detect_format(b"\0" * 128 + b"DICM" + b"rest", "image.bin") == "dicom"

    def test_dcm_extension_fallback(self):
        assert detect_format(b"unknown_content", "scan.dcm") == "dicom"

    def test_unknown_bytes_default_to_jpg(self):
        assert detect_format(b"unknown_content", "image.bin") == "jpg"


# ══════════════════════════════════════════════════════════════════════════════
# 2. preprocess_for_model
# ══════════════════════════════════════════════════════════════════════════════

class TestPreprocessForModel:
    def test_output_shape_is_1_1_224_224(self):
        tensor = preprocess_for_model(np.zeros((300, 400), dtype=np.uint8))
        assert tensor.shape == (1, 1, 224, 224)

    def test_dtype_is_float32(self):
        tensor = preprocess_for_model(np.zeros((224, 224), dtype=np.uint8))
        assert tensor.dtype == torch.float32

    def test_black_image_maps_to_minus_1024(self):
        tensor = preprocess_for_model(np.zeros((224, 224), dtype=np.uint8))
        assert float(tensor.min()) == pytest.approx(-1024.0, abs=1.0)

    def test_white_image_maps_to_plus_1024(self):
        tensor = preprocess_for_model(np.full((224, 224), 255, dtype=np.uint8))
        assert float(tensor.max()) == pytest.approx(1024.0, abs=1.0)


# ══════════════════════════════════════════════════════════════════════════════
# 3. validate_source_channels
# ══════════════════════════════════════════════════════════════════════════════

class TestValidateSourceChannels:
    def test_grayscale_png_is_accepted(self):
        validate_source_channels(_make_png_bytes(), "png")

    def test_grayscale_jpg_is_accepted(self):
        validate_source_channels(_make_jpg_bytes(), "jpg")

    def test_cmyk_jpg_raises_value_error(self):
        with pytest.raises(ValueError, match="canales"):
            validate_source_channels(_make_cmyk_jpg_bytes(), "jpg")

    def test_dicom_skips_channel_check(self):
        validate_source_channels(b"anything", "dicom")


# ══════════════════════════════════════════════════════════════════════════════
# 4. extract_pixels_from_dicom
# ══════════════════════════════════════════════════════════════════════════════

class TestExtractPixelsFromDicom:
    def test_returns_uint8_array_with_correct_shape(self):
        arr = extract_pixels_from_dicom(_make_dicom_bytes())
        assert arr.dtype == np.uint8
        assert arr.shape == (2, 2)

    def test_monochrome2_brighter_raw_pixel_has_higher_output(self):
        arr = extract_pixels_from_dicom(_make_dicom_bytes("MONOCHROME2"))
        # raw[0,1]=1000 > raw[0,0]=0 → after rescale+window → higher value
        assert arr[0, 0] < arr[0, 1]

    def test_monochrome1_inverts_intensity_vs_monochrome2(self):
        arr = extract_pixels_from_dicom(_make_dicom_bytes("MONOCHROME1"))
        # MONOCHROME1 inverts: brighter raw → lower output
        assert arr[0, 0] > arr[0, 1]

    def test_invalid_dicom_raises_value_error(self):
        with pytest.raises(ValueError, match="DICOM"):
            extract_pixels_from_dicom(b"not a dicom file" * 100)


# ══════════════════════════════════════════════════════════════════════════════
# 5. run_ensemble_inference
# ══════════════════════════════════════════════════════════════════════════════

class TestRunEnsembleInference:
    _TENSOR = torch.zeros(1, 1, 224, 224)

    def test_no_finding_when_all_logits_below_threshold(self):
        result = run_ensemble_inference(_make_ensemble(_low_logits(), _low_logits()), self._TENSOR)
        assert result["predicted_class"] == "No Finding"
        assert result["predicted_label"] == -1
        assert result["positive_findings"] == []

    def test_positive_finding_when_single_logit_high(self):
        result = run_ensemble_inference(
            _make_ensemble(_effusion_logits(), _effusion_logits()), self._TENSOR
        )
        assert result["predicted_class"] == "Effusion"
        assert result["predicted_label"] == _EFFUSION_IDX
        assert "Effusion" in result["positive_findings"]

    def test_probabilities_contains_all_14_classes(self):
        result = run_ensemble_inference(_make_ensemble(_low_logits(), _low_logits()), self._TENSOR)
        assert set(result["probabilities"].keys()) == set(CLASSES_14)

    def test_confidence_is_in_unit_interval(self):
        result = run_ensemble_inference(
            _make_ensemble(_effusion_logits(), _effusion_logits()), self._TENSOR
        )
        assert 0.0 <= result["confidence"] <= 1.0

    def test_weighted_average_of_model_outputs(self):
        logits_v1 = _effusion_logits()
        logits_v2 = _low_logits()
        ensemble = _make_ensemble(logits_v1, logits_v2, w1=0.5, w2=0.5)
        result = run_ensemble_inference(ensemble, self._TENSOR)
        expected_prob = (
            0.5 * float(torch.sigmoid(torch.tensor(3.0)).item())
            + 0.5 * float(torch.sigmoid(torch.tensor(-5.0)).item())
        )
        assert result["probabilities"]["Effusion"] == pytest.approx(expected_prob, abs=1e-5)

    def test_sub_threshold_findings_are_between_0_10_and_threshold(self):
        # sigmoid(-1.735) ≈ 0.15 → above 0.10 sub-min, below 0.30 threshold
        logits = _low_logits()
        logits[0] = -1.735  # Atelectasis
        result = run_ensemble_inference(_make_ensemble(logits, logits), self._TENSOR)
        sub_classes = [f["class"] for f in result["sub_threshold_findings"]]
        assert "Atelectasis" in sub_classes
        assert "Atelectasis" not in result["positive_findings"]


# ══════════════════════════════════════════════════════════════════════════════
# 6. Router helpers
# ══════════════════════════════════════════════════════════════════════════════

class TestValidateFileSize:
    def test_empty_bytes_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            validate_file_size(b"")
        assert exc.value.status_code == 400

    def test_below_minimum_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            validate_file_size(b"x" * 500)
        assert exc.value.status_code == 400

    def test_above_maximum_raises_413(self):
        with pytest.raises(HTTPException) as exc:
            validate_file_size(b"x" * (15 * 1024 * 1024 + 1))
        assert exc.value.status_code == 413

    def test_valid_size_passes(self):
        validate_file_size(b"x" * 5000)


class TestParseGradcamMethod:
    @pytest.mark.parametrize("method", ["gradcam", "gradcam++", "scorecam"])
    def test_valid_methods_are_returned_lowercased(self, method):
        assert _parse_gradcam_method(method) == method.lower()

    def test_mixed_case_is_normalized(self):
        assert _parse_gradcam_method("GradCAM") == "gradcam"

    def test_empty_string_defaults_to_gradcam(self):
        assert _parse_gradcam_method("") == "gradcam"

    def test_invalid_method_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            _parse_gradcam_method("unknown_method")
        assert exc.value.status_code == 400


class TestImageWarnings:
    def test_returns_list(self):
        arr = np.random.randint(30, 200, (224, 224), dtype=np.uint8)
        assert isinstance(image_warnings(arr), list)

    def test_extreme_aspect_ratio_triggers_warning(self):
        arr = np.random.randint(30, 200, (224, 50), dtype=np.uint8)
        warnings = image_warnings(arr)
        assert any("aspecto" in w.lower() for w in warnings)

    def test_flat_image_triggers_low_contrast_warning(self):
        arr = np.full((224, 224), 128, dtype=np.uint8)
        warnings = image_warnings(arr)
        assert any("contraste" in w.lower() for w in warnings)

    def test_checkerboard_triggers_high_contrast_warning(self):
        arr = np.zeros((224, 224), dtype=np.uint8)
        arr[::2, ::2] = 255
        arr[1::2, 1::2] = 255
        warnings = image_warnings(arr)
        assert any("contraste" in w.lower() for w in warnings)


# ══════════════════════════════════════════════════════════════════════════════
# 7. /health endpoint
# ══════════════════════════════════════════════════════════════════════════════

class TestHealthEndpoint:
    def test_ok_when_ensemble_loaded(self, client: TestClient):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["ensemble_loaded"] is True
        assert data["num_classes"] == 14

    def test_degraded_when_no_ensemble(self, monkeypatch):
        monkeypatch.setattr("services.prediction_service.generate_gradcam", lambda *a, **kw: "")
        with TestClient(app) as c:
            app.state.ensemble = None
            app.state.prediction_cache = LRUCache(maxsize=20)
            resp = c.get("/health")
            assert resp.json()["status"] == "degraded"
            assert resp.json()["ensemble_loaded"] is False


# ══════════════════════════════════════════════════════════════════════════════
# 8. /model-info endpoint
# ══════════════════════════════════════════════════════════════════════════════

class TestModelInfoEndpoint:
    def test_returns_ensemble_type_and_14_classes(self, client: TestClient):
        resp = client.get("/model-info")
        assert resp.status_code == 200
        data = resp.json()
        assert data["type"] == "ensemble"
        assert data["num_classes"] == 14

    def test_includes_thresholds_and_metrics(self, client: TestClient):
        data = client.get("/model-info").json()
        assert "thresholds" in data
        assert "metrics" in data


# ══════════════════════════════════════════════════════════════════════════════
# 9. /predict endpoint
# ══════════════════════════════════════════════════════════════════════════════

class TestPredictEndpoint:
    def test_valid_png_returns_200(self, client: TestClient):
        resp = client.post("/predict", files={"file": ("test.png", _make_png_bytes(), "image/png")})
        assert resp.status_code == 200

    def test_response_contains_required_fields(self, client: TestClient):
        data = client.post(
            "/predict", files={"file": ("test.png", _make_png_bytes(), "image/png")}
        ).json()
        required = {
            "predicted_class", "predicted_label", "confidence", "probabilities",
            "positive_findings", "gradcam_image", "gradcam_class",
            "processing_time_ms", "disclaimer", "image_hash", "cached",
            "image_warnings", "explanation",
        }
        assert required.issubset(set(data))

    def test_predicted_class_matches_mock_ensemble(self, client: TestClient):
        data = client.post(
            "/predict", files={"file": ("test.png", _make_png_bytes(), "image/png")}
        ).json()
        assert data["predicted_class"] == "Effusion"
        assert data["predicted_label"] == _EFFUSION_IDX
        assert "Effusion" in data["positive_findings"]

    def test_probabilities_cover_all_14_classes(self, client: TestClient):
        data = client.post(
            "/predict", files={"file": ("test.png", _make_png_bytes(), "image/png")}
        ).json()
        assert set(data["probabilities"].keys()) == set(CLASSES_14)

    def test_gradcam_image_is_base64_encoded(self, client: TestClient):
        data = client.post(
            "/predict", files={"file": ("test.png", _make_png_bytes(), "image/png")}
        ).json()
        assert data["gradcam_image"].startswith("data:image/png;base64,")

    def test_disclaimer_is_non_empty(self, client: TestClient):
        data = client.post(
            "/predict", files={"file": ("test.png", _make_png_bytes(), "image/png")}
        ).json()
        assert len(data["disclaimer"]) > 0

    def test_empty_file_returns_400(self, client: TestClient):
        resp = client.post("/predict", files={"file": ("empty.png", b"", "image/png")})
        assert resp.status_code == 400

    def test_too_small_image_returns_422(self, client: TestClient):
        resp = client.post(
            "/predict", files={"file": ("tiny.png", _make_png_bytes(32, 32), "image/png")}
        )
        assert resp.status_code == 422

    def test_invalid_bytes_returns_422(self, client: TestClient):
        resp = client.post(
            "/predict", files={"file": ("bad.jpg", b"not-an-image" * 200, "image/jpeg")}
        )
        assert resp.status_code == 422

    def test_cmyk_jpg_returns_422_with_channels_message(self, client: TestClient):
        resp = client.post(
            "/predict", files={"file": ("cmyk.jpg", _make_cmyk_jpg_bytes(), "image/jpeg")}
        )
        assert resp.status_code == 422
        assert "canales" in resp.json()["detail"]

    def test_second_identical_request_is_served_from_cache(self, client: TestClient):
        png = _make_png_bytes()
        client.post("/predict", files={"file": ("test.png", png, "image/png")})
        resp2 = client.post("/predict", files={"file": ("test.png", png, "image/png")})
        assert resp2.json()["cached"] is True

    def test_no_ensemble_returns_503(self, monkeypatch):
        monkeypatch.setattr("services.prediction_service.generate_gradcam", lambda *a, **kw: "")
        with TestClient(app) as c:
            app.state.ensemble = None
            app.state.prediction_cache = LRUCache(maxsize=20)
            resp = c.post("/predict", files={"file": ("test.png", _make_png_bytes(), "image/png")})
            assert resp.status_code == 503

    def test_scorecam_method_accepted(self, client: TestClient):
        resp = client.post(
            "/predict?gradcam_method=scorecam",
            files={"file": ("test.png", _make_png_bytes(), "image/png")},
        )
        assert resp.status_code == 200

    def test_invalid_gradcam_method_returns_400(self, client: TestClient):
        resp = client.post(
            "/predict?gradcam_method=invalid",
            files={"file": ("test.png", _make_png_bytes(), "image/png")},
        )
        assert resp.status_code == 400

    def test_include_gradcam_false_returns_empty_gradcam(self, client: TestClient):
        resp = client.post(
            "/predict?include_gradcam=false",
            files={"file": ("test.png", _make_png_bytes(), "image/png")},
        )
        assert resp.status_code == 200
        assert resp.json()["gradcam_image"] == ""


# ══════════════════════════════════════════════════════════════════════════════
# 10. /predict-batch endpoint
# ══════════════════════════════════════════════════════════════════════════════

class TestPredictBatchEndpoint:
    def test_two_images_return_two_results(self, client: TestClient):
        png = _make_png_bytes()
        resp = client.post(
            "/predict-batch",
            files=[
                ("files", ("a.png", png, "image/png")),
                ("files", ("b.png", png, "image/png")),
            ],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 2
        assert data["results"][0]["filename"] == "a.png"
        assert data["results"][1]["filename"] == "b.png"

    def test_response_includes_total_processing_time(self, client: TestClient):
        png = _make_png_bytes()
        resp = client.post(
            "/predict-batch",
            files=[("files", ("a.png", png, "image/png"))],
        )
        assert "processing_time_ms" in resp.json()

    def test_more_than_8_images_returns_413(self, client: TestClient):
        png = _make_png_bytes()
        files = [("files", (f"img{i}.png", png, "image/png")) for i in range(9)]
        resp = client.post("/predict-batch", files=files)
        assert resp.status_code == 413

    def test_invalid_image_in_batch_returns_error_not_abort(self, client: TestClient):
        png = _make_png_bytes()
        resp = client.post(
            "/predict-batch",
            files=[
                ("files", ("ok.png", png, "image/png")),
                ("files", ("bad.jpg", b"not-an-image" * 200, "image/jpeg")),
            ],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"][0]["result"] is not None
        assert data["results"][1]["error"] is not None

    def test_duplicate_images_in_batch_use_cache(self, client: TestClient):
        png = _make_png_bytes()
        resp = client.post(
            "/predict-batch",
            files=[
                ("files", ("a.png", png, "image/png")),
                ("files", ("b.png", png, "image/png")),
            ],
        )
        data = resp.json()
        assert data["results"][1]["result"]["cached"] is True
