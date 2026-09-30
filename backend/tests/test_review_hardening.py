import os
import sys
from pathlib import Path
from types import SimpleNamespace

os.environ['CXR_SKIP_MODEL_LOAD'] = '1'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from main import app
from services.prediction_service import model_bundle_version


def test_readiness_fails_closed_without_model():
    with TestClient(app) as client:
        app.state.ensemble = None
        assert client.get('/ready').status_code == 503
        app.state.ensemble = {'loaded': True}
        assert client.get('/ready').status_code == 200


def test_bundle_version_changes_when_artifact_fingerprint_changes():
    a = SimpleNamespace(model_manifest={'model_fingerprint': 'a' * 64})
    b = SimpleNamespace(model_manifest={'model_fingerprint': 'b' * 64})
    assert model_bundle_version(a) != model_bundle_version(b)
    assert 'xrv224-v1' in model_bundle_version(a)
    assert 'unverified' in model_bundle_version(SimpleNamespace())
