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
from fastapi.testclient import TestClient
from PIL import Image
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, SecondaryCaptureImageStorage, generate_uid

from main import app
from services.dicom_service import extract_pixels_from_dicom
from utils.image_utils import detect_format


class MockModel(torch.nn.Module):
    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        return torch.tensor([[-2.0, 1.0, 2.0, 0.0]], dtype=torch.float32)


@pytest.fixture()
def client(monkeypatch):
    def fake_gradcam(model, tensor, img_array, predicted_label, method="gradcam"):
        return "data:image/png;base64,ZmFrZQ=="

    monkeypatch.setattr("routers.predict.generate_gradcam", fake_gradcam)

    with TestClient(app) as c:
        app.state.model = MockModel()
        app.state.thresholds = {"0": 0.45, "1": 0.38, "2": 0.42, "3": 0.20}
        app.state.model_config = {
            "num_classes": 4,
            "embedding_dim": 512,
            "num_heads": 8,
            "num_layers": 4,
            "mlp_dim": 1024,
            "dropout": 0.1,
            "backbone": "densenet121-res224-nih",
        }
        app.state.prediction_cache = {}
        yield c


def _make_png_bytes(width: int = 224, height: int = 224) -> bytes:
    arr = np.random.randint(0, 256, (height, width), dtype=np.uint8)
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_cmyk_jpg_bytes(width: int = 224, height: int = 224) -> bytes:
    img = Image.new("CMYK", (width, height), (0, 128, 128, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
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
    ds.Rows = pixel_data.shape[0]
    ds.Columns = pixel_data.shape[1]
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = photometric
    ds.BitsAllocated = 16
    ds.BitsStored = 16
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


def test_health_reports_loaded_model(client: TestClient):
    resp = client.get("/health")
    data = resp.json()

    assert resp.status_code == 200
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    assert data["checkpoint"] == "sprint3_model.pt"
    assert data["classes"] == ["No Finding", "Cardiomegaly", "Effusion", "Infiltration"]


def test_model_info_returns_centralized_thresholds(client: TestClient):
    resp = client.get("/model-info")
    data = resp.json()

    assert resp.status_code == 200
    assert data["thresholds"] == {"0": 0.45, "1": 0.38, "2": 0.42, "3": 0.20}
    assert data["num_classes"] == 4
    assert "metrics" in data


def test_detect_format_uses_magic_bytes_and_extension():
    assert detect_format(b"\x89PNG\r\n\x1a\nrest", "image.jpg") == "png"
    assert detect_format(b"\xff\xd8rest", "image.png") == "jpg"
    assert detect_format(b"\0" * 128 + b"DICM" + b"rest", "image.bin") == "dicom"
    assert detect_format(b"unknown", "image.dcm") == "dicom"


def test_predict_returns_multilabel_sigmoid_probabilities(client: TestClient):
    png = _make_png_bytes()
    resp = client.post("/predict", files={"file": ("test.png", png, "image/png")})
    data = resp.json()

    assert resp.status_code == 200
    assert data["predicted_class"] == "Effusion"
    assert data["predicted_label"] == 2
    assert data["positive_findings"] == ["Cardiomegaly", "Effusion", "Infiltration"]
    assert data["probabilities"]["No Finding"] == pytest.approx(0.119203, abs=1e-6)
    assert data["probabilities"]["Effusion"] == pytest.approx(0.880797, abs=1e-6)
    assert sum(data["probabilities"].values()) != pytest.approx(1.0, abs=1e-4)


def test_predict_response_shape(client: TestClient):
    png = _make_png_bytes()
    resp = client.post("/predict", files={"file": ("test.png", png, "image/png")})
    data = resp.json()

    assert set(data) == {
        "predicted_class",
        "predicted_label",
        "confidence",
        "probabilities",
        "positive_findings",
        "gradcam_image",
        "gradcam_class",
        "processing_time_ms",
        "disclaimer",
        "image_hash",
        "cached",
        "image_warnings",
        "uncertainty_std",
    }
    assert data["gradcam_image"].startswith("data:image/png;base64,")


def test_predict_batch_returns_per_file_results(client: TestClient):
    png = _make_png_bytes()
    resp = client.post(
        "/predict-batch",
        files=[
            ("files", ("a.png", png, "image/png")),
            ("files", ("b.png", png, "image/png")),
        ],
    )
    data = resp.json()

    assert resp.status_code == 200
    assert len(data["results"]) == 2
    assert data["results"][0]["filename"] == "a.png"
    assert data["results"][0]["result"]["predicted_class"] == "Effusion"


def test_predict_empty_file_returns_400(client: TestClient):
    resp = client.post("/predict", files={"file": ("empty.png", b"", "image/png")})
    assert resp.status_code == 400


def test_predict_tiny_image_returns_422(client: TestClient):
    png = _make_png_bytes(width=32, height=80)
    resp = client.post("/predict", files={"file": ("tiny.png", png, "image/png")})
    assert resp.status_code == 422
    assert "Imagen demasiado" in resp.json()["detail"]


def test_predict_invalid_jpg_returns_422(client: TestClient):
    payload = b"not-an-image" * 200
    resp = client.post("/predict", files={"file": ("bad.jpg", payload, "image/jpeg")})
    assert resp.status_code == 422
    assert "No se pudo decodificar" in resp.json()["detail"]


def test_predict_rejects_more_than_three_channels(client: TestClient):
    payload = _make_cmyk_jpg_bytes()
    resp = client.post("/predict", files={"file": ("cmyk.jpg", payload, "image/jpeg")})
    assert resp.status_code == 422
    assert "canales" in resp.json()["detail"]


def test_dicom_applies_rescale_window_and_photometric_inversion():
    mono2 = extract_pixels_from_dicom(_make_dicom_bytes("MONOCHROME2"))
    mono1 = extract_pixels_from_dicom(_make_dicom_bytes("MONOCHROME1"))

    assert mono2.dtype == np.uint8
    assert mono2.shape == (2, 2)
    assert mono2[0, 0] < mono2[0, 1]
    assert mono1[0, 0] > mono1[0, 1]
