import time

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from schemas.prediction import PredictionResponse
from services.gradcam_service import generate_gradcam
from services.model_service import run_inference
from utils.image_utils import detect_format, load_image_as_array, preprocess_for_model

router = APIRouter()

LABELS = {0: "No Finding", 1: "Cardiomegaly", 2: "Effusion", 3: "Infiltration"}

DISCLAIMER = (
    "Uso académico. Este sistema no reemplaza el criterio clínico del radiólogo. "
    "Desarrollado para el Hospital Nacional Arzobispo Loayza (HNAL), Lima, Perú."
)


@router.post("/predict", response_model=PredictionResponse)
async def predict(request: Request, file: UploadFile = File(...)):
    t0 = time.perf_counter()

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    fmt = detect_format(file_bytes, file.filename or "")
    img_array = load_image_as_array(file_bytes, fmt)
    tensor = preprocess_for_model(img_array)

    model = request.app.state.model
    thresholds: dict = request.app.state.thresholds

    result = run_inference(model, tensor)
    probs: list[float] = result["probs"]
    predicted_label: int = result["predicted_label"]
    predicted_class: str = LABELS[predicted_label]

    probabilities = {LABELS[i]: round(probs[i], 6) for i in range(4)}

    positive_findings = [
        LABELS[i] for i in range(4) if probs[i] >= float(thresholds[str(i)])
    ]

    gradcam_image = generate_gradcam(model, tensor, img_array, predicted_label)

    elapsed_ms = (time.perf_counter() - t0) * 1000

    return PredictionResponse(
        predicted_class=predicted_class,
        predicted_label=predicted_label,
        confidence=round(probs[predicted_label], 6),
        probabilities=probabilities,
        positive_findings=positive_findings,
        gradcam_image=gradcam_image,
        gradcam_class=predicted_class,
        processing_time_ms=round(elapsed_ms, 1),
        disclaimer=DISCLAIMER,
    )
