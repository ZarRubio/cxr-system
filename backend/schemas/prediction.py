from pydantic import BaseModel


class PredictionResponse(BaseModel):
    predicted_class: str
    predicted_label: int
    confidence: float
    probabilities: dict[str, float]
    positive_findings: list[str]
    gradcam_image: str
    gradcam_class: str
    processing_time_ms: float
    disclaimer: str
    image_hash: str | None = None
    cached: bool = False
    image_warnings: list[str] = []
    uncertainty_std: dict[str, float] | None = None
    explanation: dict[str, str] | None = None


class BatchPredictionItem(BaseModel):
    filename: str
    result: PredictionResponse | None = None
    error: str | None = None


class BatchPredictionResponse(BaseModel):
    results: list[BatchPredictionItem]
    processing_time_ms: float
