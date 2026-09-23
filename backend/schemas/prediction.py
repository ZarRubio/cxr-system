from pydantic import BaseModel


class DicomMeta(BaseModel):
    """Metadatos no identificantes extraidos del DICOM (pseudonimizados)."""

    patient_age: int | None = None
    patient_sex: str | None = None      # M / F / O
    view_position: str | None = None    # PA / AP / LL / RL / LATERAL
    study_hash: str | None = None       # sha256(StudyInstanceUID)[:10]


class CXRScreening(BaseModel):
    """Resultado del control tecnico de compatibilidad con radiografia de torax."""

    status: str                         # likely_cxr / uncertain / not_cxr
    score: float                        # score heuristico, no probabilidad clinica
    method: str
    reasons: list[str] = []


class DecisionSupport(BaseModel):
    """Consistencia interna del ensemble; no equivale a certeza clinica."""

    status: str  # stable / borderline / discordant
    method: str
    focus_class: str
    ensemble_score: float
    threshold: float
    threshold_margin: float
    model_disagreement: float
    requires_heightened_review: bool
    calibrated_probability: bool = False
    reasons: list[str] = []
    recommendation: str


class PredictionResponse(BaseModel):
    predicted_class: str
    predicted_label: int              # -1 si No Finding
    confidence: float
    probabilities: dict[str, float]   # 14 clases
    positive_findings: list[str]      # clases sobre threshold
    sub_threshold_findings: list[dict[str, str | float]] = []  # clases entre 0.10 y threshold
    gradcam_image: str
    image_preview: str = ""
    gradcam_class: str
    processing_time_ms: float
    disclaimer: str
    model_version: str = "ensemble-v1v2-14classes"
    image_hash: str | None = None
    cached: bool = False
    image_warnings: list[str] = []
    cxr_screening: CXRScreening
    decision_support: DecisionSupport
    explanation: dict[str, str] | None = None
    dicom_meta: DicomMeta | None = None


class BatchPredictionItem(BaseModel):
    filename: str
    result: PredictionResponse | None = None
    error: str | None = None


class BatchPredictionResponse(BaseModel):
    results: list[BatchPredictionItem]
    processing_time_ms: float
