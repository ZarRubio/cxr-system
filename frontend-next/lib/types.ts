export interface Prediction {
  email_alert?: import('./data/analysis').EmailAlert
  /** ID del registro persistido en el historial (lo añade /api/predict) */
  analysis_id?: string
  predicted_class: string
  confidence: number
  probabilities: Record<string, number>
  positive_findings: string[]
  gradcam_image?: string
  /** Decoded display image; not persisted in study records. */
  image_preview?: string
  gradcam_class?: string
  processing_time_ms: number
  image_hash?: string
  model_version?: string
  disclaimer?: string
  cached?: boolean
  sub_threshold_findings?: Array<{ class: string; probability: number }>
  image_warnings?: string[]
  cxr_screening?: {
    status: 'likely_cxr' | 'uncertain' | 'not_cxr'
    /** Score tecnico heuristico; no representa probabilidad diagnostica. */
    score: number
    method: string
    reasons: string[]
  }
  decision_support?: {
    status: 'stable' | 'borderline' | 'discordant'
    method: string
    focus_class: string
    ensemble_score: number
    threshold: number
    threshold_margin: number
    model_disagreement: number
    requires_heightened_review: boolean
    calibrated_probability: false
    reasons: string[]
    recommendation: string
  }
  explanation?: {
    summary?: string
    visual?: string
    clinical?: string
  }
  /** Metadatos no identificantes extraídos del DICOM (pseudonimizados) */
  dicom_meta?: {
    patient_age?: number | null
    patient_sex?: string | null
    view_position?: string | null
    study_hash?: string | null
  } | null
}

export interface ModelInfo {
  type?: string
  auc_macro?: number
  val_auc_macro?: number
  cache_entries?: number
  startup_error?: string
  embedding_dim?: number
  num_heads?: number
  num_layers?: number
  mlp_dim?: number
  dropout?: number
  num_classes?: number
  classes?: Record<string, string>
  thresholds?: Record<string, number>
  metrics?: Record<string, ClassMetrics>
  metrics_provenance?: string
  checkpoint_metrics?: Record<string, {
    phase?: string
    epoch?: number
    best_val_auc_macro?: number
    best_val_map?: number
    num_classes?: number
    num_layers?: number
  }>
  score_semantics?: string
  evaluation_status?: {
    calibration?: string
    temperature?: number
    external_hnal_validation?: string
    patient_level_split?: string
    threshold_optimization?: string
    unavailable_metrics?: string[]
  }
  error?: string
}

export interface ClassMetrics {
  auc?: number
  sensitivity?: number
  specificity?: number
}

export type Severity = 'critical' | 'high' | 'moderate' | 'normal'

export interface CXRUser {
  email?: string | null
  id:        string
  name:      string
  username:  string
  password:  string
  role:      'admin' | 'radiologist'
  cmp:       string | null
  specialty?: string
  active:    boolean
  createdAt: string
}

export interface HistoryEntry {
  id: string
  timestamp: string
  filename: string
  predicted: string
  confidence: number
  severity: Severity
  imageHash?: string
  prediction: Prediction
  fileBytes?: Uint8Array
  studyMeta?: {
    studyId: string
    projection: string
    clinicalIndication: string
    radiologistName?: string
    radiologistCmp?: string
  }
}
