"""
Tests de infraestructura: LRUCache, auth por API key, audit_service y settings.
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

os.environ["CXR_SKIP_MODEL_LOAD"] = "1"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

from main import app
from settings import Settings, settings
from utils.cache import LRUCache

# ══════════════════════════════════════════════════════════════════════════════
# LRUCache
# ══════════════════════════════════════════════════════════════════════════════

class TestLRUCache:
    def test_put_and_get(self):
        cache = LRUCache(maxsize=3)
        cache.put("a", 1)
        assert cache.get("a") == 1

    def test_get_missing_returns_none(self):
        assert LRUCache(maxsize=3).get("nope") is None

    def test_eviction_removes_least_recently_used(self):
        cache = LRUCache(maxsize=2)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.get("a")          # "a" pasa a ser el mas reciente
        cache.put("c", 3)       # expulsa "b"
        assert cache.get("b") is None
        assert cache.get("a") == 1
        assert cache.get("c") == 3

    def test_len_and_contains(self):
        cache = LRUCache(maxsize=5)
        cache.put("x", 1)
        assert len(cache) == 1
        assert "x" in cache
        assert "y" not in cache

    def test_put_existing_key_updates_value(self):
        cache = LRUCache(maxsize=2)
        cache.put("a", 1)
        cache.put("a", 2)
        assert cache.get("a") == 2
        assert len(cache) == 1

    def test_maxsize_must_be_positive(self):
        with pytest.raises(ValueError):
            LRUCache(maxsize=0)

    def test_concurrent_access_respects_bound(self):
        cache = LRUCache(maxsize=10)

        def worker(n: int) -> None:
            for i in range(200):
                cache.put(f"k{n}_{i}", i)
                cache.get(f"k{n}_{i}")

        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(worker, range(8)))

        assert len(cache) <= 10


# ══════════════════════════════════════════════════════════════════════════════
# API key auth
# ══════════════════════════════════════════════════════════════════════════════

class TestApiKeyAuth:
    def test_no_key_configured_allows_requests(self, monkeypatch):
        monkeypatch.setattr(settings, "api_key", "")
        with TestClient(app) as client:
            assert client.get("/model-info").status_code == 200

    def test_missing_key_returns_401_when_configured(self, monkeypatch):
        monkeypatch.setattr(settings, "api_key", "secreta")
        with TestClient(app) as client:
            resp = client.get("/model-info")
        assert resp.status_code == 401

    def test_wrong_key_returns_401(self, monkeypatch):
        monkeypatch.setattr(settings, "api_key", "secreta")
        with TestClient(app) as client:
            resp = client.get("/model-info", headers={"X-API-Key": "incorrecta"})
        assert resp.status_code == 401

    def test_correct_key_allows_request(self, monkeypatch):
        monkeypatch.setattr(settings, "api_key", "secreta")
        with TestClient(app) as client:
            resp = client.get("/model-info", headers={"X-API-Key": "secreta"})
        assert resp.status_code == 200

    def test_health_stays_open_with_key_configured(self, monkeypatch):
        monkeypatch.setattr(settings, "api_key", "secreta")
        with TestClient(app) as client:
            assert client.get("/health").status_code == 200

    def test_predict_requires_key(self, monkeypatch):
        monkeypatch.setattr(settings, "api_key", "secreta")
        with TestClient(app) as client:
            resp = client.post("/predict", files={"file": ("t.png", b"x" * 2000, "image/png")})
        assert resp.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# audit_service
# ══════════════════════════════════════════════════════════════════════════════

class TestAuditService:
    def test_writes_jsonl_line_with_timestamp(self, tmp_path, monkeypatch):
        from services import audit_service

        audit_path = tmp_path / "audit.jsonl"
        monkeypatch.setattr(audit_service.settings, "audit_log_path", str(audit_path))

        audit_service.write_audit_event({"event_type": "prediction", "image_hash": "abc"})

        lines = audit_path.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 1
        event = json.loads(lines[0])
        assert event["event_type"] == "prediction"
        assert event["image_hash"] == "abc"
        assert "timestamp" in event

    def test_appends_multiple_events(self, tmp_path, monkeypatch):
        from services import audit_service

        audit_path = tmp_path / "audit.jsonl"
        monkeypatch.setattr(audit_service.settings, "audit_log_path", str(audit_path))

        for i in range(3):
            audit_service.write_audit_event({"event_type": "prediction", "n": i})

        lines = audit_path.read_text(encoding="utf-8").strip().splitlines()
        assert [json.loads(ln)["n"] for ln in lines] == [0, 1, 2]

    def test_unwritable_path_does_not_raise(self, monkeypatch):
        from services import audit_service

        # Ruta invalida en Windows y Linux: un directorio como archivo
        monkeypatch.setattr(audit_service.settings, "audit_log_path", "")
        audit_service.write_audit_event({"event_type": "prediction"})  # no debe lanzar


# ══════════════════════════════════════════════════════════════════════════════
# Settings
# ══════════════════════════════════════════════════════════════════════════════

class TestSettings:
    def test_env_prefix_is_respected(self, monkeypatch):
        monkeypatch.setenv("CXR_MAX_UPLOAD_MB", "5")
        s = Settings()
        assert s.max_upload_mb == 5
        assert s.max_file_bytes == 5 * 1024 * 1024

    def test_cors_origin_list_splits_and_strips(self, monkeypatch):
        monkeypatch.setenv("CXR_CORS_ORIGINS", "http://a.com , http://b.com,")
        s = Settings()
        assert s.cors_origin_list == ["http://a.com", "http://b.com"]

    def test_api_key_defaults_to_empty(self, monkeypatch):
        monkeypatch.delenv("CXR_API_KEY", raising=False)
        assert Settings().api_key == ""
