import type { Prediction, Severity } from '@/lib/types'
import { SEVERITY_MAP } from '@/lib/constants'

/**
 * Tipos del historial clínico persistente y helpers puros compartidos
 * entre el servidor (stores) y el cliente (página de historial).
 * No se persisten imágenes ni Grad-CAM: solo metadatos y resultados.
 */

export interface AnalysisFeedback {
  /** true = el radiólogo concuerda con el hallazgo principal del modelo */
  agrees: boolean
  /** Hallazgo real según el radiólogo (solo cuando agrees=false) */
  actualFinding: string | null
  comment: string | null
  createdAt: string
}

export interface AnalysisRecord {
  id: string
  userId: string
  userName: string
  createdAt: string
  filename: string
  studyId: string | null
  projection: string | null
  clinicalIndication: string | null
  /** Metadatos DICOM pseudonimizados (null en PNG/JPG o DICOM sin tags) */
  patientAge: number | null
  patientSex: string | null
  dicomStudyHash: string | null
  predictedClass: string
  confidence: number
  severity: Severity
  probabilities: Record<string, number>
  positiveFindings: string[]
  imageHash: string | null
  modelVersion: string | null
  processingTimeMs: number | null
  feedback: AnalysisFeedback | null
}

export type FeedbackFilter = 'pending' | 'agree' | 'disagree'

export interface AnalysisFilters {
  q?: string
  severity?: Severity
  feedback?: FeedbackFilter
  /** Fecha local YYYY-MM-DD inclusive */
  dateFrom?: string
  /** Fecha local YYYY-MM-DD inclusive */
  dateTo?: string
  /** Nombre exacto del radiólogo (vista admin) */
  userName?: string
}

/** createdAt (ISO UTC) -> fecha local YYYY-MM-DD, comparable con los filtros. */
function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Construye el registro persistente a partir de una predicción del backend. */
export function buildAnalysisRecord(
  user: { id: string; name: string },
  prediction: Prediction,
  study: { filename: string; studyId?: string | null; projection?: string | null; clinicalIndication?: string | null },
): AnalysisRecord {
  return {
    id: crypto.randomUUID(),
    userId: user.id,
    userName: user.name,
    createdAt: new Date().toISOString(),
    filename: study.filename,
    studyId: study.studyId ?? null,
    // La proyección del DICOM (ViewPosition) manda sobre la del formulario
    projection: prediction.dicom_meta?.view_position ?? study.projection ?? null,
    clinicalIndication: study.clinicalIndication ?? null,
    patientAge: prediction.dicom_meta?.patient_age ?? null,
    patientSex: prediction.dicom_meta?.patient_sex ?? null,
    dicomStudyHash: prediction.dicom_meta?.study_hash ?? null,
    predictedClass: prediction.predicted_class,
    confidence: prediction.confidence,
    severity: SEVERITY_MAP[prediction.predicted_class] ?? 'normal',
    probabilities: prediction.probabilities ?? {},
    positiveFindings: prediction.positive_findings ?? [],
    imageHash: prediction.image_hash ?? null,
    modelVersion: prediction.model_version ?? null,
    processingTimeMs: prediction.processing_time_ms ?? null,
    feedback: null,
  }
}

/** Orden de triage: severidad más grave primero, luego confianza descendente. */
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, moderate: 2, normal: 3 }

export function triageRank(severity: Severity, confidence: number): number {
  return SEVERITY_RANK[severity] * 1000 + Math.round((1 - confidence) * 999)
}

/** Filtrado en memoria, idéntico en servidor y cliente. */
export function filterAnalyses(records: AnalysisRecord[], filters: AnalysisFilters): AnalysisRecord[] {
  const q = filters.q?.trim().toLowerCase()
  return records.filter((r) => {
    if (filters.severity && r.severity !== filters.severity) return false
    if (filters.userName && r.userName !== filters.userName) return false
    if (filters.dateFrom && localDate(r.createdAt) < filters.dateFrom) return false
    if (filters.dateTo && localDate(r.createdAt) > filters.dateTo) return false
    if (filters.feedback === 'pending' && r.feedback !== null) return false
    if (filters.feedback === 'agree' && r.feedback?.agrees !== true) return false
    if (filters.feedback === 'disagree' && r.feedback?.agrees !== false) return false
    if (q) {
      const haystack = [r.studyId ?? '', r.filename, r.predictedClass, r.userName]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}
