import hashlib
import logging
import time

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from rate_limit import limiter
from schemas.prediction import BatchPredictionItem, BatchPredictionResponse, PredictionResponse
from services.audit_service import write_audit_event
from services.gradcam_service import generate_gradcam
from services.model_service import run_inference, run_inference_mc_dropout
from settings import settings
from utils.image_utils import (
    detect_format,
    load_image_as_array,
    preprocess_for_model,
    validate_source_channels,
)

router = APIRouter()
logger = logging.getLogger("cxr.predict")

LABELS = {0: "No Finding", 1: "Cardiomegaly", 2: "Effusion", 3: "Infiltration"}

DISCLAIMER = (
    "Uso academico. Este sistema no reemplaza el criterio clinico del radiologo. "
    "Desarrollado para el Hospital Nacional Arzobispo Loayza (HNAL), Lima, Peru."
)

CLASS_DISCLAIMERS = {
    "Infiltration": (
        " Para Infiltration, considerar correlacion clinica y tamizaje de TB segun "
        "protocolo local HNAL."
    )
}

CLASS_EXPLANATIONS = {
    "No Finding": {
        "summary": "No se observaron patrones suficientes para superar los umbrales de hallazgo.",
        "visual": "El mapa de calor puede mostrar atencion difusa o regiones anatomicas normales.",
        "clinical": "Debe interpretarse como apoyo academico; no descarta patologia si la clinica sugiere lo contrario.",
    },
    "Cardiomegaly": {
        "summary": "El modelo puede estar respondiendo a aumento aparente de la silueta cardiaca.",
        "visual": "Revise si el mapa se concentra sobre mediastino y contorno cardiaco.",
        "clinical": "Correlacionar con proyeccion, indice cardiotoracico y datos clinicos.",
    },
    "Effusion": {
        "summary": "El modelo puede estar respondiendo a opacidades basales o borramiento del angulo costofrenico.",
        "visual": "Revise si el mapa resalta bases pulmonares, regiones pleurales o senos costodiafragmaticos.",
        "clinical": "Puede requerir proyeccion lateral, ecografia o correlacion con sintomas.",
    },
    "Infiltration": {
        "summary": "El modelo puede estar respondiendo a opacidades pulmonares compatibles con infiltrado.",
        "visual": "Revise si el mapa se concentra en campos pulmonares con aumento de densidad.",
        "clinical": "En contexto HNAL, correlacionar con sospecha de neumonia o tuberculosis.",
    },
}

_MAX_FILE_BYTES = 15 * 1024 * 1024
_MIN_FILE_BYTES = 1 * 1024
_MIN_DIM = 64
_CACHE_MAX = 20


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _validate_file_size(file_bytes: bytes) -> None:
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    if len(file_bytes) < _MIN_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo demasiado pequeno ({len(file_bytes)} bytes). Es una imagen valida?",
        )

    if len(file_bytes) > _MAX_FILE_BYTES:
        size_mb = len(file_bytes) / 1024 / 1024
        raise HTTPException(
            status_code=413,
            detail=f"Imagen demasiado grande ({size_mb:.1f} MB). Maximo permitido: 15 MB.",
        )


def _image_warnings(img_array) -> list[str]:
    warnings = []
    h, w = img_array.shape[:2]
    aspect = max(h, w) / max(min(h, w), 1)
    if aspect > 2.2:
        warnings.append("La relacion de aspecto no parece tipica de una radiografia de torax.")
    if float(img_array.std()) < 8.0:
        warnings.append("La imagen tiene muy bajo contraste; verificar que sea una CXR valida.")
    return warnings


def _parse_mc_passes(raw_value: str) -> int:
    try:
        value = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="mc_passes debe ser un entero entre 1 y 20.") from exc
    if value < 1 or value > 20:
        raise HTTPException(status_code=400, detail="mc_passes debe estar entre 1 y 20.")
    return value


def _parse_gradcam_method(raw_value: str) -> str:
    value = (raw_value or "gradcam").lower()
    if value not in {"gradcam", "gradcam++", "scorecam"}:
        raise HTTPException(status_code=400, detail="gradcam_method debe ser gradcam, gradcam++ o scorecam.")
    return value


def _build_prediction(
    request: Request,
    file_bytes: bytes,
    filename: str,
    gradcam_method: str = "gradcam",
    mc_passes: int = 1,
    include_gradcam: bool = True,
) -> PredictionResponse:
    t0 = time.perf_counter()
    _validate_file_size(file_bytes)

    image_hash = hashlib.sha256(file_bytes).hexdigest()
    cache_key = f"{image_hash}:{gradcam_method}:{mc_passes}:{include_gradcam}"
    cache: dict = request.app.state.prediction_cache

    if cache_key in cache:
        cached = dict(cache[cache_key])
        cached["processing_time_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        cached["cached"] = True
        logger.info("prediction_cache_hit", extra={"image_hash": image_hash, "client_ip": _client_ip(request)})
        return PredictionResponse(**cached)

    fmt = detect_format(file_bytes, filename)

    try:
        validate_source_channels(file_bytes, fmt)
        img_array = load_image_as_array(file_bytes, fmt)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"No se pudo decodificar la imagen ({fmt}): {exc}",
        ) from exc

    if len(img_array.shape) != 2:
        raise HTTPException(status_code=422, detail="La imagen debe ser monocanal o convertible a escala de grises.")

    h, w = img_array.shape[:2]
    if h < _MIN_DIM or w < _MIN_DIM:
        raise HTTPException(
            status_code=422,
            detail=f"Imagen demasiado pequena ({w}x{h} px). Minimo requerido: {_MIN_DIM}x{_MIN_DIM} px.",
        )

    tensor = preprocess_for_model(img_array)
    model = request.app.state.model
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo no cargado.")

    thresholds: dict = request.app.state.thresholds
    model_config: dict = getattr(request.app.state, "model_config", {})
    temperature = float(model_config.get("temperature", 1.0))

    if mc_passes > 1:
        result = run_inference_mc_dropout(
            model,
            tensor,
            passes=min(mc_passes, 20),
            temperature=temperature,
        )
    else:
        result = run_inference(model, tensor, temperature=temperature)
    probs: list[float] = result["probs"]
    predicted_label: int = result["predicted_label"]
    predicted_class: str = LABELS[predicted_label]

    probabilities = {LABELS[i]: round(probs[i], 6) for i in range(4)}
    uncertainty_std = None
    if "std" in result:
        uncertainty_std = {LABELS[i]: round(result["std"][i], 6) for i in range(4)}

    # Multi-label: hallazgos positivos = todos los que superan su umbral individual
    positive_findings = [
        LABELS[i] for i in range(4) if probs[i] >= float(thresholds[str(i)])
    ]

    # Hallazgo primario: mayor probabilidad entre los positivos; si ninguno supera umbral,
    # el de mayor probabilidad (modelo informa incertidumbre).
    if positive_findings:
        predicted_label = max(
            (i for i in range(4) if probs[i] >= float(thresholds[str(i)])),
            key=lambda i: probs[i],
        )
    else:
        predicted_label = int(result["predicted_label"])
    predicted_class = LABELS[predicted_label]

    gradcam_image = (
        generate_gradcam(model, tensor, img_array, predicted_label, gradcam_method)
        if include_gradcam else ""
    )
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

    response_data = dict(
        predicted_class=predicted_class,
        predicted_label=predicted_label,
        confidence=round(probs[predicted_label], 6),
        probabilities=probabilities,
        positive_findings=positive_findings,
        gradcam_image=gradcam_image,
        gradcam_class=predicted_class,
        processing_time_ms=elapsed_ms,
        disclaimer=DISCLAIMER + CLASS_DISCLAIMERS.get(predicted_class, ""),
        image_hash=image_hash,
        cached=False,
        image_warnings=_image_warnings(img_array),
        uncertainty_std=uncertainty_std,
        explanation=CLASS_EXPLANATIONS.get(predicted_class),
    )

    if len(cache) >= _CACHE_MAX:
        oldest_key = next(iter(cache))
        del cache[oldest_key]
    cache[cache_key] = response_data

    logger.info(
        "prediction_completed",
        extra={
            "image_hash": image_hash,
            "predicted_class": predicted_class,
            "processing_time_ms": elapsed_ms,
            "client_ip": _client_ip(request),
        },
    )
    write_audit_event(
        {
            "event_type": "prediction",
            "image_hash": image_hash,
            "predicted_class": predicted_class,
            "confidence": response_data["confidence"],
            "positive_findings": positive_findings,
        }
    )

    return PredictionResponse(**response_data)


@router.post("/predict", response_model=PredictionResponse)
@limiter.limit(settings.rate_limit_predict)
async def predict(request: Request, file: UploadFile = File(...)):
    file_bytes = await file.read()
    gradcam_method = _parse_gradcam_method(request.query_params.get("gradcam_method", "gradcam"))
    mc_passes = _parse_mc_passes(request.query_params.get("mc_passes", "1"))
    include_gradcam = request.query_params.get("include_gradcam", "true").lower() != "false"
    return _build_prediction(request, file_bytes, file.filename or "", gradcam_method, mc_passes, include_gradcam)


@router.post("/predict-batch", response_model=BatchPredictionResponse)
@limiter.limit(settings.rate_limit_predict)
async def predict_batch(request: Request, files: list[UploadFile] = File(...)):
    t0 = time.perf_counter()
    if len(files) > 8:
        raise HTTPException(status_code=413, detail="Maximo 8 imagenes por lote.")

    results: list[BatchPredictionItem] = []
    for file in files:
        file_bytes = await file.read()
        filename = file.filename or ""
        try:
            gradcam_method = _parse_gradcam_method(request.query_params.get("gradcam_method", "gradcam"))
            mc_passes = _parse_mc_passes(request.query_params.get("mc_passes", "1"))
            result = _build_prediction(request, file_bytes, filename, gradcam_method, mc_passes)
            results.append(BatchPredictionItem(filename=filename, result=result))
        except HTTPException as exc:
            results.append(BatchPredictionItem(filename=filename, error=str(exc.detail)))

    return BatchPredictionResponse(
        results=results,
        processing_time_ms=round((time.perf_counter() - t0) * 1000, 1),
    )
