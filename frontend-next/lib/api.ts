import type { ModelInfo, Prediction } from './types'
import type { AnalysisFilters, AnalysisRecord } from './data/analysis'

/**
 * Cliente HTTP del navegador. Todas las llamadas van a rutas /api del propio
 * frontend (route handlers), que validan la sesión y reenvían al backend.
 */

export async function fetchModelInfo(): Promise<ModelInfo> {
  const res = await fetch('/api/model-info')
  if (!res.ok) throw new Error(`Backend error: ${res.status}`)
  return res.json()
}

export interface StudyHeaders {
  studyId?: string
  projection?: string
  clinicalIndication?: string
}

export async function predict(
  fileBytes: Uint8Array,
  filename: string,
  gradcamMethod = 'gradcam',
  includeGradcam = true,
  study?: StudyHeaders,
): Promise<Prediction> {
  const form = new FormData()
  form.append('file', new Blob([fileBytes.buffer as ArrayBuffer]), filename)

  const params = new URLSearchParams({
    gradcam_method: gradcamMethod,
    include_gradcam: String(includeGradcam),
  })

  // Metadatos del estudio para el historial persistente. URI-encoded porque
  // los headers HTTP no admiten caracteres fuera de ASCII (tildes, ñ).
  const headers: Record<string, string> = { 'x-cxr-filename': encodeURIComponent(filename) }
  if (study?.studyId) headers['x-cxr-study-id'] = encodeURIComponent(study.studyId)
  if (study?.projection) headers['x-cxr-projection'] = encodeURIComponent(study.projection)
  if (study?.clinicalIndication) headers['x-cxr-indication'] = encodeURIComponent(study.clinicalIndication)

  const res = await fetch(`/api/predict?${params}`, {
    method: 'POST',
    body: form,
    headers,
    signal: AbortSignal.timeout(300_000),
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.detail ?? `Error ${res.status}`)
  }
  return res.json()
}

export interface BatchResultItem {
  filename: string
  result: (Prediction & { analysis_id?: string }) | null
  error: string | null
}

export interface BatchResponse {
  results: BatchResultItem[]
  processing_time_ms: number
}

export async function predictBatch(
  files: Array<{ bytes: Uint8Array; name: string }>,
): Promise<BatchResponse> {
  const form = new FormData()
  for (const f of files) {
    form.append('files', new Blob([f.bytes.buffer as ArrayBuffer]), f.name)
  }
  const res = await fetch('/api/predict-batch?include_gradcam=false', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(300_000),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.detail ?? `Error ${res.status}`)
  }
  return res.json()
}

export async function fetchAnalyses(
  filters: AnalysisFilters = {},
): Promise<{ analyses: AnalysisRecord[]; isAdmin: boolean }> {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.feedback) params.set('feedback', filters.feedback)
  const qs = params.toString()
  const res = await fetch(`/api/analyses${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function submitFeedback(
  analysisId: string,
  feedback: { agrees: boolean; actualFinding?: string; comment?: string },
): Promise<AnalysisRecord> {
  const res = await fetch(`/api/analyses/${analysisId}/feedback`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.error ?? `Error ${res.status}`)
  }
  return res.json()
}
