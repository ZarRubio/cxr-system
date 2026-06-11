import type { ModelInfo, Prediction } from './types'

const BACKEND_URL =
  (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export async function fetchModelInfo(): Promise<ModelInfo> {
  const res = await fetch(`${BACKEND_URL}/model-info`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`Backend error: ${res.status}`)
  return res.json()
}

export async function predict(
  fileBytes: Uint8Array,
  filename: string,
  gradcamMethod = 'gradcam',
  mcPasses = 1,
  includeGradcam = true,
): Promise<Prediction> {
  const form = new FormData()
  form.append('file', new Blob([fileBytes.buffer as ArrayBuffer]), filename)

  const params = new URLSearchParams({
    gradcam_method: gradcamMethod,
    mc_passes: String(mcPasses),
    include_gradcam: String(includeGradcam),
  })

  const res = await fetch(`${BACKEND_URL}/predict?${params}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(240_000),
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.detail ?? `Error ${res.status}`)
  }
  return res.json()
}
