import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from rate_limit import RATE_LIMITING_AVAILABLE, limiter
from routers import predict
from settings import settings

if RATE_LIMITING_AVAILABLE:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

_START_TIME = time.time()
_BASE_DIR = Path(__file__).resolve().parent
_ARTIFACTS_DIR = _BASE_DIR / "artifacts"
_MODEL_LOAD_SECONDS = 0.0


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        reserved = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__)
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in reserved and key not in {"message", "asctime"}:
                payload[key] = value
        return json.dumps(payload, ensure_ascii=True, default=str)


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)

LABELS_14 = {
    "0": "Atelectasis", "1": "Cardiomegaly", "2": "Consolidation",
    "3": "Edema", "4": "Effusion", "5": "Emphysema", "6": "Fibrosis",
    "7": "Hernia", "8": "Infiltration", "9": "Mass", "10": "Nodule",
    "11": "Pleural_Thickening", "12": "Pneumonia", "13": "Pneumothorax",
}

AUC_METRICS = {
    "Atelectasis":        {"auc": 0.716},
    "Cardiomegaly":       {"auc": 0.877},
    "Consolidation":      {"auc": 0.703},
    "Edema":              {"auc": 0.835},
    "Effusion":           {"auc": 0.864},
    "Emphysema":          {"auc": 0.892},
    "Fibrosis":           {"auc": 0.805},
    "Hernia":             {"auc": 0.916},
    "Infiltration":       {"auc": 0.695},
    "Mass":               {"auc": 0.823},
    "Nodule":             {"auc": 0.757},
    "Pleural_Thickening": {"auc": 0.784},
    "Pneumonia":          {"auc": 0.768},
    "Pneumothorax":       {"auc": 0.871},
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.model_service import load_ensemble

    global _MODEL_LOAD_SECONDS
    t0 = time.perf_counter()
    app.state.startup_error = None

    if settings.skip_model_load:
        app.state.ensemble = None
    else:
        try:
            app.state.ensemble = load_ensemble(str(_ARTIFACTS_DIR))
            thr_config = json.loads(
                (_ARTIFACTS_DIR / "thresholds_14.json").read_text(encoding="utf-8")
            )
            app.state.ensemble["temperature"] = thr_config.get("temperature", 1.0)
        except Exception as exc:
            app.state.ensemble = None
            app.state.startup_error = f"No se pudo cargar el ensemble: {exc}"
            logging.getLogger("cxr.startup").exception("ensemble_load_failed")
    _MODEL_LOAD_SECONDS = round(time.perf_counter() - t0, 3)

    try:
        app.state.labels = json.loads(
            (_ARTIFACTS_DIR / "labels_14.json").read_text(encoding="utf-8")
        )
    except Exception:
        app.state.labels = LABELS_14

    try:
        app.state.thresholds = json.loads(
            (_ARTIFACTS_DIR / "thresholds_14.json").read_text(encoding="utf-8")
        )["thresholds"]
    except Exception:
        app.state.thresholds = {cls: 0.3 for cls in LABELS_14.values()}

    try:
        app.state.model_config = json.loads(
            (_ARTIFACTS_DIR / "model_config_14.json").read_text(encoding="utf-8")
        )
    except Exception:
        app.state.model_config = {}

    try:
        app.state.ensemble_config = json.loads(
            (_ARTIFACTS_DIR / "ensemble_config.json").read_text(encoding="utf-8")
        )
    except Exception:
        app.state.ensemble_config = {}

    app.state.prediction_cache = {}

    yield


app = FastAPI(
    title="CXR Classification API",
    description="Clasificacion de radiografias de torax — HNAL 2026",
    version="2.0.0",
    lifespan=lifespan,
)

if RATE_LIMITING_AVAILABLE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)


@app.get("/health", tags=["ops"])
async def health(request: Request):
    ensemble_loaded = (
        hasattr(request.app.state, "ensemble")
        and request.app.state.ensemble is not None
    )
    return {
        "status": "ok" if ensemble_loaded else "degraded",
        "ensemble_loaded": ensemble_loaded,
        "num_classes": 14,
        "model_type": "ensemble",
        "model_load_seconds": _MODEL_LOAD_SECONDS,
        "uptime_seconds": round(time.time() - _START_TIME, 1),
        "rate_limiting": RATE_LIMITING_AVAILABLE,
        "startup_error": getattr(request.app.state, "startup_error", None),
    }


@app.get("/model-info", tags=["ops"])
async def model_info(request: Request):
    cfg = getattr(request.app.state, "model_config", {})
    ens_cfg = getattr(request.app.state, "ensemble_config", {})
    thresholds = getattr(request.app.state, "thresholds", {})
    cache_size = len(getattr(request.app.state, "prediction_cache", {}))

    return {
        "type": "ensemble",
        "models": ["CNN-ViT v1 (4 capas ViT)", "CNN-ViT v2 (6 capas ViT)"],
        "weights": [ens_cfg.get("weight_v1", 0.3), ens_cfg.get("weight_v2", 0.7)],
        "architecture": "CNN-ViT (DenseNet121 + Vision Transformer)",
        "backbone": cfg.get("backbone", "densenet121-res224-nih"),
        "embedding_dim": cfg.get("embedding_dim", 512),
        "num_heads": cfg.get("num_heads", 8),
        "mlp_dim": cfg.get("mlp_dim", 1024),
        "dropout": cfg.get("dropout", 0.1),
        "num_classes": cfg.get("num_classes", 14),
        "task": "multi-label",
        "input_size": "224x224",
        "normalization": "xrv [-1024, 1024]",
        "classes": LABELS_14,
        "thresholds": thresholds,
        "metrics": AUC_METRICS,
        "auc_macro": ens_cfg.get("test_auc_macro", 0.8045),
        "val_auc_macro": ens_cfg.get("val_auc_macro", 0.7950),
        "reference": "Wang et al. 2017 (AUC macro: 0.7452)",
        "cache_entries": cache_size,
        "rate_limiting": RATE_LIMITING_AVAILABLE,
        "startup_error": getattr(request.app.state, "startup_error", None),
    }
