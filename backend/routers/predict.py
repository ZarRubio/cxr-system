"""
Endpoints de prediccion. La logica vive en services.prediction_service;
aqui solo se parsean parametros y se delega.
"""
import time

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from auth import require_api_key
from rate_limit import limiter
from schemas.prediction import BatchPredictionItem, BatchPredictionResponse, PredictionResponse
from services.prediction_service import PredictOptions, predict_image
from settings import settings

router = APIRouter(dependencies=[Depends(require_api_key)])

_VALID_GRADCAM_METHODS = {"gradcam", "gradcam++", "scorecam"}


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _parse_gradcam_method(raw_value: str) -> str:
    value = (raw_value or "gradcam").lower()
    if value not in _VALID_GRADCAM_METHODS:
        raise HTTPException(status_code=400, detail="gradcam_method debe ser gradcam, gradcam++ o scorecam.")
    return value


def _parse_options(request: Request) -> PredictOptions:
    return PredictOptions(
        gradcam_method=_parse_gradcam_method(request.query_params.get("gradcam_method", "gradcam")),
        include_gradcam=request.query_params.get("include_gradcam", "true").lower() != "false",
    )


@router.post("/predict", response_model=PredictionResponse)
@limiter.limit(settings.rate_limit_predict)
async def predict(request: Request, file: UploadFile = File(...)):
    file_bytes = await file.read()
    options = _parse_options(request)
    return predict_image(
        request.app.state, file_bytes, file.filename or "", options, client_ip=_client_ip(request)
    )


@router.post("/predict-batch", response_model=BatchPredictionResponse)
@limiter.limit(settings.rate_limit_predict)
async def predict_batch(request: Request, files: list[UploadFile] = File(...)):
    t0 = time.perf_counter()
    if len(files) > settings.batch_max_files:
        raise HTTPException(
            status_code=413,
            detail=f"Maximo {settings.batch_max_files} imagenes por lote.",
        )

    options = _parse_options(request)
    client_ip = _client_ip(request)

    results: list[BatchPredictionItem] = []
    for file in files:
        file_bytes = await file.read()
        filename = file.filename or ""
        try:
            result = predict_image(request.app.state, file_bytes, filename, options, client_ip=client_ip)
            results.append(BatchPredictionItem(filename=filename, result=result))
        except HTTPException as exc:
            results.append(BatchPredictionItem(filename=filename, error=str(exc.detail)))

    return BatchPredictionResponse(
        results=results,
        processing_time_ms=round((time.perf_counter() - t0) * 1000, 1),
    )
