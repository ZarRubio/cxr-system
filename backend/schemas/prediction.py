from pydantic import BaseModel


class DicomMeta(BaseModel):
    """Metadatos no identificantes extraidos del DICOM (pseudonimizados)."""

    patient_age: int | None = None
    patient_sex: str | None = None      # M / F / O
    view_position: str | None = None    # PA / AP / LL / RL / LATERAL
    study_hash: str | None = None       # sha256(StudyInstanceUID)[:10]


class PredictionResponse(BaseModel):
    predicted_class: str
    predicted_label: int              # -1 si No Finding
    confidence: float
    probabilities: dict[str, float]   # 14 clases
    positive_findings: list[str]      # clases sobre threshold
    sub_threshold_findings: list[dict[str, str | float]] = []  # clases entre 0.10 y threshold
    gradcam_image: str
    gradcam_class: str
    processing_time_ms: float
    disclaimer: str
    model_version: str = "ensemble-v1v2-14classes"
    image_hash: str | None = None
    cached: bool = False
    image_warnings: list[str] = []
    explanation: dict[str, str] | None = None
    dicom_meta: DicomMeta | None = None


class BatchPredictionItem(BaseModel):
    filename: str
    result: PredictionResponse | None = None
    error: str | None = None


class BatchPredictionResponse(BaseModel):
    results: list[BatchPredictionItem]
    processing_time_ms: float
