import type { ModelInfo, Prediction } from './types'

/**
 * Cliente HTTP del navegador. Todas las llamadas van a rutas /api del propio
 * frontend (route handlers), que validan la sesión y reenvían al backend.
 */

export async function fetchModelInfo(): Promise<ModelInfo> {
  const res = await fetch('/api/model-info')
  if (!res.ok) throw new Error(`Backend error: ${res.status}`)
  return res.json()
}

export async function predict(
  fileBytes: Uint8Array,
  filename: string,
  gradcamMethod = 'gradcam',
  includeGradcam = true,
): Promise<Prediction> {
  const form = new FormData()
  form.append('file', new Blob([fileBytes.buffer as ArrayBuffer]), filename)

  const params = new URLSearchParams({
    gradcam_method: gradcamMethod,
    include_gradcam: String(includeGradcam),
  })

  const res = await fetch(`/api/predict?${params}`, {
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
