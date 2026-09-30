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
  explanationId?: string
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
  if (study?.explanationId) params.set('explain_analysis_id', study.explanationId)

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
  /** ID del lote asignado a todos los análisis persistidos (LOTE-YYYYMMDD-nnn) */
  batch_id?: string
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
  cursor?: string,
): Promise<{ analyses: AnalysisRecord[]; isAdmin: boolean; nextCursor?: string | null }> {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.feedback) params.set('feedback', filters.feedback)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.userName) params.set('userName', filters.userName)
  if (cursor) params.set('cursor', cursor)
  const qs = params.toString()
  const res = await fetch(`/api/analyses${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function fetchAllAnalyses(filters: AnalysisFilters = {}) {
  const analyses: AnalysisRecord[] = []
  let cursor: string | undefined
  let isAdmin = false
  const seen = new Set<string>()
  for (let page = 0; page < 100; page++) {
    const result = await fetchAnalyses(filters, cursor)
    isAdmin = result.isAdmin
    for (const record of result.analyses) if (!seen.has(record.id)) { seen.add(record.id); analyses.push(record) }
    if (!result.nextCursor) return { analyses, isAdmin }
    if (result.nextCursor === cursor) throw new Error('El historial no avanzo de pagina.')
    cursor = result.nextCursor
  }
  throw new Error('El historial supera el limite de consulta. Acote el rango de fechas para exportar o consultar estadisticas.')
}

export async function submitFeedback(
  analysisId: string,
  feedback: { agrees: boolean; actualFinding?: string; comment?: string; reviewPriority?: 'routine' | 'priority' | 'urgent' },
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

export async function saveAnalysisNotes(analysisId: string, notes: string): Promise<AnalysisRecord> {
  const res = await fetch(`/api/analyses/${analysisId}/notes`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'No se pudieron guardar las observaciones.')
  }
  return res.json()
}

export async function retryAnalysisEmail(analysisId: string, role: 'admin' | 'radiologist'): Promise<void> {
  const res = await fetch(`/api/analyses/${analysisId}/retry-email`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'No se pudo reintentar el envío.')
  }
}
