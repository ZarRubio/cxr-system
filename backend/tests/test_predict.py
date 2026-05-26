import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _make_png_bytes(width: int = 224, height: int = 224) -> bytes:
    """Creates a synthetic grayscale PNG image for testing."""
    arr = np.random.randint(0, 256, (height, width), dtype=np.uint8)
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_health(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_predict_returns_200(client: TestClient):
    png = _make_png_bytes()
    resp = client.post("/predict", files={"file": ("test.png", png, "image/png")})
    assert resp.status_code == 200


def test_predict_response_shape(client: TestClient):
    png = _make_png_bytes()
    resp = client.post("/predict", files={"file": ("test.png", png, "image/png")})
    data = resp.json()

    assert "predicted_class" in data
    assert "predicted_label" in data
    assert "confidence" in data
    assert "probabilities" in data
    assert "positive_findings" in data
    assert "gradcam_image" in data
    assert "gradcam_class" in data
    assert "processing_time_ms" in data
    assert "disclaimer" in data


def test_predict_probabilities_sum_to_one(client: TestClient):
    png = _make_png_bytes()
    resp = client.post("/predict", files={"file": ("test.png", png, "image/png")})
    probs = resp.json()["probabilities"]
    total = sum(probs.values())
    assert abs(total - 1.0) < 1e-4


def test_predict_gradcam_is_base64_png(client: TestClient):
    png = _make_png_bytes()
    resp = client.post("/predict", files={"file": ("test.png", png, "image/png")})
    gradcam = resp.json()["gradcam_image"]
    assert gradcam.startswith("data:image/png;base64,")


def test_predict_empty_file_returns_400(client: TestClient):
    resp = client.post("/predict", files={"file": ("empty.png", b"", "image/png")})
    assert resp.status_code == 400
