import hashlib
import logging
import time

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from rate_limit import limiter
from schemas.prediction import BatchPredictionItem, BatchPredictionResponse, PredictionResponse
from services.audit_service import write_audit_event
from services.gradcam_service import generate_gradcam
from services.model_service import CLASSES_14, run_ensemble_inference
from settings import settings
from utils.image_utils import (
    detect_format,
    load_image_as_array,
    preprocess_for_model,
    validate_source_channels,
)

router = APIRouter()
logger = logging.getLogger("cxr.predict")

DISCLAIMER = (
    "Uso academico. Este sistema no reemplaza el criterio clinico del radiologo. "
    "Desarrollado para el Hospital Nacional Arzobispo Loayza (HNAL), Lima, Peru."
)

CLASS_DISCLAIMERS = {
    "Infiltration": (
        " Para Infiltration, considerar correlacion clinica y tamizaje de TB segun "
        "protocolo local HNAL."
    ),
    "Pneumonia": (
        " Para Pneumonia, en contexto HNAL Lima, descartar tuberculosis segun protocolo local."
    ),
}

CLASS_EXPLANATIONS = {
    "Atelectasis": {
        "summary": "El modelo puede estar respondiendo a colapso parcial o total de uno o mas lobulos.",
        "visual": "Revise si el mapa se concentra en zonas de menor densidad o hacia las bases.",
        "clinical": "Correlacionar con clinica; frecuente en postoperados o pacientes encamados.",
    },
    "Cardiomegaly": {
        "summary": "El modelo puede estar respondiendo a aumento aparente de la silueta cardiaca.",
        "visual": "Revise si el mapa se concentra sobre mediastino y contorno cardiaco.",
        "clinical": "Correlacionar con proyeccion, indice cardiotoracico y datos clinicos.",
    },
    "Consolidation": {
        "summary": "El modelo puede estar respondiendo a ocupacion alveolar por liquido o tejido.",
        "visual": "Revise si el mapa resalta areas de aumento de densidad homogeneo.",
        "clinical": "Considerar neumonia bacteriana; correlacionar con fiebre y clinica.",
    },
    "Edema": {
        "summary": "El modelo puede estar respondiendo a patron de edema pulmonar bilateral.",
        "visual": "Revise si el mapa resalta regiones perihiliares o basales bilaterales.",
        "clinical": "Evaluar insuficiencia cardiaca o causas no cardiogenicas.",
    },
    "Effusion": {
        "summary": "El modelo puede estar respondiendo a opacidades basales o borramiento del angulo costofrenico.",
        "visual": "Revise si el mapa resalta bases pulmonares o senos costodiafragmaticos.",
        "clinical": "Puede requerir proyeccion lateral, ecografia o correlacion con sintomas.",
    },
    "Emphysema": {
        "summary": "El modelo puede estar respondiendo a hiperinsuflacion y destruccion alveolar.",
        "visual": "Revise si el mapa resalta campos pulmonares con mayor translucidez.",
        "clinical": "Correlacionar con espirometria y antecedentes tabaquicos.",
    },
    "Fibrosis": {
        "summary": "El modelo puede estar respondiendo a patron fibrotico pulmonar.",
        "visual": "Revise si el mapa muestra patron reticular o zonas de distorsion arquitectural.",
        "clinical": "Considerar fibrosis intersticial; correlacionar con antecedentes y TCAR.",
    },
    "Hernia": {
        "summary": "El modelo puede estar respondiendo a hernia diafragmatica.",
        "visual": "Revise si el mapa resalta region diafragmatica o base pulmonar.",
        "clinical": "Confirmar con TC; evaluar contenido herniado.",
    },
    "Infiltration": {
        "summary": "El modelo puede estar respondiendo a opacidades pulmonares compatibles con infiltrado.",
        "visual": "Revise si el mapa se concentra en campos pulmonares con aumento de densidad.",
        "clinical": "En contexto HNAL, correlacionar con sospecha de neumonia o tuberculosis.",
    },
    "Mass": {
        "summary": "El modelo puede estar respondiendo a lesion pulmonar mayor de 3 cm.",
        "visual": "Revise si el mapa resalta lesion focal de gran tamano.",
        "clinical": "Requiere estudio tomografico urgente para caracterizacion.",
    },
    "Nodule": {
        "summary": "El modelo puede estar respondiendo a lesion focal menor de 3 cm.",
        "visual": "Revise si el mapa resalta lesion nodular focal.",
        "clinical": "Seguimiento segun protocolo de nodulo pulmonar; considerar TC.",
    },
    "Pleural_Thickening": {
        "summary": "El modelo puede estar respondiendo a engrosamiento de la pleura.",
        "visual": "Revise si el mapa resalta la interfaz pleural.",
        "clinical": "Correlacionar con antecedentes de exposicion o derrame previo.",
    },
    "Pneumonia": {
        "summary": "El modelo puede estar respondiendo a consolidacion neumofica.",
        "visual": "Revise si el mapa resalta area de consolidacion lobar o segmentaria.",
        "clinical": "En contexto HNAL Lima, considerar tamizaje de tuberculosis.",
    },
    "Pneumothorax": {
        "summary": "El modelo puede estar respondiendo a linea pleural y ausencia de trama vascular.",
        "visual": "Revise si el mapa resalta la periferia del campo pulmonar afectado.",
        "clinical": "Verificar linea pleural en radiografia en espiracion; urgencia si es a tension.",
    },
    "No Finding": {
        "summary": "No se observaron patrones suficientes para superar los umbrales de hallazgo.",
        "visual": "El mapa de calor puede mostrar atencion difusa o regiones anatomicas normales.",
        "clinical": "Interpretar como apoyo academico; no descarta patologia si la clinica sugiere lo contrario.",
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
    cache_key = f"{image_hash}:{gradcam_method}:{include_gradcam}"
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

    ensemble = getattr(request.app.state, "ensemble", None)
    if ensemble is None:
        raise HTTPException(status_code=503, detail="Modelo no cargado.")

    tensor = preprocess_for_model(img_array)
    result = run_ensemble_inference(ensemble, tensor)

    # Grad-CAM: usar v2; si No Finding, usar clase de mayor probabilidad
    if result["predicted_class"] == "No Finding":
        gradcam_cls = CLASSES_14[result["argmax_label"]]
    else:
        gradcam_cls = result["positive_findings"][0] if result["positive_findings"] else result["predicted_class"]

    gradcam_label = CLASSES_14.index(gradcam_cls) if gradcam_cls in CLASSES_14 else 0
    gradcam_image = (
        generate_gradcam(ensemble["model_v2"], tensor, img_array, gradcam_label, gradcam_method)
        if include_gradcam else ""
    )

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    predicted_class = result["predicted_class"]

    response_data = dict(
        predicted_class=predicted_class,
        predicted_label=result["predicted_label"],
        confidence=result["confidence"],
        probabilities=result["probabilities"],
        positive_findings=result["positive_findings"],
        gradcam_image=gradcam_image,
        gradcam_class=gradcam_cls,
        processing_time_ms=elapsed_ms,
        disclaimer=DISCLAIMER + CLASS_DISCLAIMERS.get(predicted_class, ""),
        model_version="ensemble-v1v2-14classes",
        image_hash=image_hash,
        cached=False,
        image_warnings=_image_warnings(img_array),
        uncertainty_std=None,
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
            "positive_findings": result["positive_findings"],
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
            "positive_findings": result["positive_findings"],
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
