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

# Marca el momento de arranque para calcular uptime
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

LABELS = {0: "No Finding", 1: "Cardiomegaly", 2: "Effusion", 3: "Infiltration"}

AUC_METRICS = {
    "No Finding":   {"auc": 0.818, "sensitivity": 0.765, "specificity": 0.740},
    "Cardiomegaly": {"auc": 0.931, "sensitivity": 0.857, "specificity": 0.874},
    "Effusion":     {"auc": 0.926, "sensitivity": 0.706, "specificity": 0.931},
    "Infiltration": {"auc": 0.786, "sensitivity": 0.167, "specificity": 0.978},
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.model_service import load_model

    global _MODEL_LOAD_SECONDS
    t0 = time.perf_counter()
    app.state.startup_error = None

    if settings.skip_model_load:
        app.state.model = None
    else:
        try:
            app.state.model = load_model(str(_ARTIFACTS_DIR / settings.model_checkpoint))
        except Exception as exc:
            app.state.model = None
            app.state.startup_error = f"No se pudo cargar el modelo: {exc}"
            logging.getLogger("cxr.startup").exception("model_load_failed")
    _MODEL_LOAD_SECONDS = round(time.perf_counter() - t0, 3)

    try:
        with open(_ARTIFACTS_DIR / "thresholds.json", encoding="utf-8") as f:
            app.state.thresholds = json.load(f)["thresholds"]
    except Exception as exc:
        app.state.thresholds = {"0": 0.45, "1": 0.38, "2": 0.42, "3": 0.20}
        app.state.startup_error = f"No se pudieron cargar thresholds.json: {exc}"

    try:
        with open(_ARTIFACTS_DIR / "model_config.json", encoding="utf-8") as f:
            app.state.model_config = json.load(f)
    except Exception:
        app.state.model_config = {}

    # Caché de inferencia: {sha256_hex: response_dict}, máx. 20 entradas (FIFO)
    app.state.prediction_cache = {}

    yield


app = FastAPI(
    title="CXR Classification API",
    description="Clasificación de radiografías de tórax — HNAL 2026",
    version="1.0.0",
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


# ── MEJORA 2: Health check completo ─────────────────────────────────────────
@app.get("/health", tags=["ops"])
async def health(request: Request):
    model_loaded = (
        hasattr(request.app.state, "model")
        and request.app.state.model is not None
    )
    return {
        "status": "ok" if model_loaded else "degraded",
        "model_loaded": model_loaded,
        "checkpoint": settings.model_checkpoint,
        "classes": list(LABELS.values()),
        "model_load_seconds": _MODEL_LOAD_SECONDS,
        "uptime_seconds": round(time.time() - _START_TIME, 1),
        "rate_limiting": RATE_LIMITING_AVAILABLE,
        "startup_error": getattr(request.app.state, "startup_error", None),
    }


# ── MEJORA 3: GET /model-info ────────────────────────────────────────────────
@app.get("/model-info", tags=["ops"])
async def model_info(request: Request):
    cfg = getattr(request.app.state, "model_config", {})
    thresholds = getattr(request.app.state, "thresholds", {})
    cache_size = len(getattr(request.app.state, "prediction_cache", {}))

    return {
        "checkpoint": settings.model_checkpoint,
        "architecture": "CNN-ViT (DenseNet121 + Vision Transformer)",
        "backbone": cfg.get("backbone", "densenet121-res224-nih"),
        "embedding_dim": cfg.get("embedding_dim", 512),
        "num_heads": cfg.get("num_heads", 8),
        "num_layers": cfg.get("num_layers", 4),
        "mlp_dim": cfg.get("mlp_dim", 1024),
        "dropout": cfg.get("dropout", 0.1),
        "temperature": cfg.get("temperature", 1.0),
        "num_classes": cfg.get("num_classes", 4),
        "input_size": "224×224",
        "normalization": "xrv [-1024, 1024]",
        "classes": LABELS,
        "thresholds": thresholds,
        "metrics": AUC_METRICS,
        "auc_macro": 0.865,
        "cache_entries": cache_size,
        "rate_limiting": RATE_LIMITING_AVAILABLE,
        "startup_error": getattr(request.app.state, "startup_error", None),
    }
