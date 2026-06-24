from pydantic import BaseModel


class PredictionResponse(BaseModel):
    predicted_class: str
    predicted_label: int              # -1 si No Finding
    confidence: float
    probabilities: dict[str, float]   # 14 clases
    positive_findings: list[str]      # clases sobre threshold
    sub_threshold_findings: list[dict[str, float]] = []  # clases entre 0.10 y threshold
    gradcam_image: str
    gradcam_class: str
    processing_time_ms: float
    disclaimer: str
    model_version: str = "ensemble-v1v2-14classes"
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
