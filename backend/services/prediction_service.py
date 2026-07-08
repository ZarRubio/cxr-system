"""
Pipeline de prediccion: validacion, decodificacion, inferencia, Grad-CAM,
armado de respuesta, cache y auditoria. Los routers solo parsean parametros
y delegan aqui.
"""
import hashlib
import logging
import time
from dataclasses import dataclass

import numpy as np
from fastapi import HTTPException

from constants.clinical_text import CLASS_DISCLAIMERS, CLASS_EXPLANATIONS, DISCLAIMER
from schemas.prediction import PredictionResponse
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

logger = logging.getLogger("cxr.predict")

MODEL_VERSION = "ensemble-v1v2-14classes"


@dataclass(frozen=True)
class PredictOptions:
    gradcam_method: str = "gradcam"
    include_gradcam: bool = True

    @property
    def cache_suffix(self) -> str:
        return f"{self.gradcam_method}:{self.include_gradcam}"


def validate_file_size(file_bytes: bytes) -> None:
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")
    if len(file_bytes) < settings.min_file_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo demasiado pequeno ({len(file_bytes)} bytes). Es una imagen valida?",
        )
    if len(file_bytes) > settings.max_file_bytes:
        size_mb = len(file_bytes) / 1024 / 1024
        raise HTTPException(
            status_code=413,
            detail=f"Imagen demasiado grande ({size_mb:.1f} MB). Maximo permitido: {settings.max_upload_mb} MB.",
        )


def image_warnings(img_array: np.ndarray) -> list[str]:
    """Heuristicas de calidad de imagen; nunca bloquean la prediccion."""
    warnings = []
    h, w = img_array.shape[:2]

    # Aspecto no tipico de CXR (PA/AP ~1:1 a 1:1.4)
    aspect = max(h, w) / max(min(h, w), 1)
    if aspect > 2.0:
        warnings.append("Relacion de aspecto inusual para CXR PA/AP. Verificar recorte o proyeccion.")

    # Contraste muy bajo -> imagen sobreexpuesta o invalida
    std = float(img_array.std())
    if std < 8.0:
        warnings.append("Imagen con muy bajo contraste. Verificar exposicion o que sea una CXR valida.")

    # Contraste muy alto -> posible artefacto o imagen sintetica
    if std > 115.0:
        warnings.append("Contraste excesivamente alto. Verificar artefactos o procesamiento previo.")

    # Hipoinspiracion: si el tercio superior es mucho mas denso que el inferior,
    # puede indicar diafragma alto o proyeccion inusual.
    try:
        img_f = img_array.astype("float32")
        top_third = img_f[: h // 3, :]
        bot_third = img_f[2 * h // 3 :, :]
        if top_third.mean() > bot_third.mean() * 1.5:
            warnings.append(
                "Posible hipoinspiración o proyeccion inusual: zona superior más densa que la inferior."
            )
    except Exception:
        pass

    # Rotacion: hemicampos con luminosidades muy asimetricas
    try:
        left_half = float(img_array[:, : w // 2].mean())
        right_half = float(img_array[:, w // 2 :].mean())
        ratio = max(left_half, right_half) / max(min(left_half, right_half), 1)
        if ratio > 1.6:
            warnings.append(
                "Posible rotacion del paciente: asimetria significativa entre hemicampos."
            )
    except Exception:
        pass

    return warnings


def _decode_and_validate(file_bytes: bytes, filename: str) -> np.ndarray:
    """Detecta formato, decodifica a escala de grises y valida dimensiones."""
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
        raise HTTPException(
            status_code=422,
            detail="La imagen debe ser monocanal o convertible a escala de grises.",
        )

    h, w = img_array.shape[:2]
    if h < settings.min_image_dim or w < settings.min_image_dim:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Imagen demasiado pequena ({w}x{h} px). "
                f"Minimo requerido: {settings.min_image_dim}x{settings.min_image_dim} px."
            ),
        )
    if h > settings.max_image_dim or w > settings.max_image_dim:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Imagen demasiado grande ({w}x{h} px). "
                f"Maximo permitido: {settings.max_image_dim}x{settings.max_image_dim} px."
            ),
        )
    return img_array


def _run_prediction(ensemble: dict, img_array: np.ndarray, options: PredictOptions) -> tuple[dict, str, str]:
    """Inferencia del ensemble + Grad-CAM. Devuelve (result, gradcam_image, gradcam_class)."""
    tensor = preprocess_for_model(img_array)
    result = run_ensemble_inference(ensemble, tensor)

    # Grad-CAM: usar v2; si No Finding, usar la clase de mayor probabilidad
    if result["predicted_class"] == "No Finding":
        gradcam_cls = CLASSES_14[result["argmax_label"]]
    else:
        gradcam_cls = result["positive_findings"][0] if result["positive_findings"] else result["predicted_class"]

    gradcam_label = CLASSES_14.index(gradcam_cls) if gradcam_cls in CLASSES_14 else 0
    gradcam_image = (
        generate_gradcam(ensemble["model_v2"], tensor, img_array, gradcam_label, options.gradcam_method)
        if options.include_gradcam else ""
    )
    return result, gradcam_image, gradcam_cls


def _build_response_data(
    result: dict,
    img_array: np.ndarray,
    image_hash: str,
    gradcam_image: str,
    gradcam_cls: str,
    elapsed_ms: float,
) -> dict:
    predicted_class = result["predicted_class"]
    return dict(
        predicted_class=predicted_class,
        predicted_label=result["predicted_label"],
        confidence=result["confidence"],
        probabilities=result["probabilities"],
        positive_findings=result["positive_findings"],
        sub_threshold_findings=result["sub_threshold_findings"],
        gradcam_image=gradcam_image,
        gradcam_class=gradcam_cls,
        processing_time_ms=elapsed_ms,
        disclaimer=DISCLAIMER + CLASS_DISCLAIMERS.get(predicted_class, ""),
        model_version=MODEL_VERSION,
        image_hash=image_hash,
        cached=False,
        image_warnings=image_warnings(img_array),
        explanation=CLASS_EXPLANATIONS.get(predicted_class),
    )


def predict_image(
    app_state,
    file_bytes: bytes,
    filename: str,
    options: PredictOptions,
    client_ip: str = "unknown",
) -> PredictionResponse:
    """Punto de entrada unico del pipeline de prediccion."""
    t0 = time.perf_counter()
    validate_file_size(file_bytes)

    image_hash = hashlib.sha256(file_bytes).hexdigest()
    cache_key = f"{image_hash}:{options.cache_suffix}"
    cache = app_state.prediction_cache

    cached_data = cache.get(cache_key)
    if cached_data is not None:
        cached = dict(cached_data)
        cached["processing_time_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        cached["cached"] = True
        logger.info("prediction_cache_hit", extra={"image_hash": image_hash, "client_ip": client_ip})
        return PredictionResponse(**cached)

    img_array = _decode_and_validate(file_bytes, filename)

    ensemble = getattr(app_state, "ensemble", None)
    if ensemble is None:
        raise HTTPException(status_code=503, detail="Modelo no cargado.")

    result, gradcam_image, gradcam_cls = _run_prediction(ensemble, img_array, options)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
    response_data = _build_response_data(result, img_array, image_hash, gradcam_image, gradcam_cls, elapsed_ms)

    cache.put(cache_key, response_data)

    logger.info(
        "prediction_completed",
        extra={
            "image_hash": image_hash,
            "predicted_class": response_data["predicted_class"],
            "positive_findings": result["positive_findings"],
            "processing_time_ms": elapsed_ms,
            "client_ip": client_ip,
        },
    )
    write_audit_event(
        {
            "event_type": "prediction",
            "image_hash": image_hash,
            "predicted_class": response_data["predicted_class"],
            "confidence": response_data["confidence"],
            "positive_findings": result["positive_findings"],
        }
    )

    return PredictionResponse(**response_data)
