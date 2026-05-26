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
