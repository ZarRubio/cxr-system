import type { Severity } from '@/lib/types'

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
}

/** Filtrado en memoria, idéntico en servidor y cliente. */
export function filterAnalyses(records: AnalysisRecord[], filters: AnalysisFilters): AnalysisRecord[] {
  const q = filters.q?.trim().toLowerCase()
  return records.filter((r) => {
    if (filters.severity && r.severity !== filters.severity) return false
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
