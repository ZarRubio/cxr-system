export interface Prediction {
  predicted_class: string
  confidence: number
  probabilities: Record<string, number>
  positive_findings: string[]
  gradcam_image?: string
  gradcam_class?: string
  processing_time_ms: number
  image_hash?: string
  model_version?: string
  disclaimer?: string
  cached?: boolean
  sub_threshold_findings?: Array<{ class: string; probability: number }>
  uncertainty_std?: Record<string, number>
  image_warnings?: string[]
  explanation?: {
    summary?: string
    visual?: string
    clinical?: string
  }
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
  thresholds?: Record<string, number>
  metrics?: Record<string, ClassMetrics>
  error?: string
}

export interface ClassMetrics {
  auc: number
  sensitivity: number
  specificity: number
}

export type Severity = 'critical' | 'high' | 'moderate' | 'normal'

export interface CXRUser {
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
