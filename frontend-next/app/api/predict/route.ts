import type { NextRequest } from 'next/server'
import { getActiveSession } from '@/lib/active-session'
import { backendHeaders, backendUrl, passthrough } from '@/lib/backend'
import { getDataStore } from '@/lib/data/store'
import { buildAnalysisRecord } from '@/lib/data/analysis'
import type { Prediction } from '@/lib/types'
import { notifyCriticalAnalysis } from '@/lib/critical-email'
import { readBoundedBody, UploadLimitError } from '@/lib/upload-body'

export const maxDuration = 300

/** Metadatos del estudio enviados por el cliente en headers (URI-encoded). */
function studyHeader(request: NextRequest, name: string): string | null {
  const raw = request.headers.get(name)
  if (!raw) return null
  try {
    return decodeURIComponent(raw).slice(0, 300) || null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const principal = await getActiveSession()
  if (!principal) {
    return Response.json({ detail: 'No autorizado.' }, { status: 401 })
  }

  const explanationId = request.nextUrl.searchParams.get('explain_analysis_id')
  const existing = explanationId ? await getDataStore().getAnalysis(explanationId) : null
  if (explanationId && !existing) return Response.json({ detail: 'Estudio no encontrado.' }, { status: 404 })
  if (existing && existing.userId !== principal.user.id && principal.user.role !== 'admin') {
    return Response.json({ detail: 'No autorizado para este estudio.' }, { status: 403 })
  }
  if (existing && !existing.imageHash) return Response.json({ detail: 'El estudio no tiene una huella de imagen verificable.' }, { status: 409 })

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const headers = new Headers(backendHeaders(clientIp))
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('Content-Type', contentType)

  // Body bufferizado (máx. 15 MB por CXR_MAX_UPLOAD_MB): un stream no es
  // re-enviable y rompe cuando undici reintenta (p.ej. localhost ::1 -> 127.0.0.1).
  let body: Uint8Array
  try { body = await readBoundedBody(request, 15 * 1024 * 1024 + 64 * 1024) }
  catch (error) {
    if (error instanceof UploadLimitError) return Response.json({ detail: 'Maximo 15 MB por imagen.' }, { status: 413 })
    throw error
  }

  const params = new URLSearchParams(request.nextUrl.searchParams)
  params.delete('explain_analysis_id')
  if (existing) params.set('include_gradcam', 'true')
  const res = await fetch(backendUrl('/predict', params.toString()), {
    method: 'POST',
    headers,
    body: body as BodyInit,
    signal: AbortSignal.timeout(280_000),
  })

  if (!res.ok) return passthrough(res)

  // Predicción exitosa: persistir en el historial clínico antes de responder.
  // Si el guardado falla, la predicción se devuelve igual (sin analysis_id).
  const prediction = (await res.json()) as Prediction
  if (existing) {
    if (prediction.image_hash !== existing.imageHash || prediction.model_version !== existing.modelVersion) {
      return Response.json({ detail: 'La imagen o la versión del modelo no corresponde al estudio original.' }, { status: 409 })
    }
    if (!prediction.gradcam_image) return Response.json({ detail: 'El servicio no generó el mapa. Intente nuevamente.' }, { status: 502 })
    return Response.json({ gradcam_image: prediction.gradcam_image, gradcam_heatmap: prediction.gradcam_heatmap, gradcam_class: prediction.gradcam_class, image_preview: prediction.image_preview })
  }
  const record = buildAnalysisRecord(
    { id: principal.user.id, name: principal.user.name },
    prediction,
    {
      filename: studyHeader(request, 'x-cxr-filename') ?? 'imagen',
      studyId: studyHeader(request, 'x-cxr-study-id'),
      projection: studyHeader(request, 'x-cxr-projection'),
      clinicalIndication: studyHeader(request, 'x-cxr-indication'),
    },
  )

  try {
    await getDataStore().createAnalysis(record)
    prediction.analysis_id = record.id
    prediction.persistence = { status: 'saved' }
    try {
      prediction.email_alert = await notifyCriticalAnalysis(record)
    } catch {
      prediction.notification_error = true
      console.error('[predict] no se pudo completar la alerta', { analysisId: record.id })
    }
    return Response.json(prediction)
  } catch (e) {
    prediction.persistence = { status: 'failed', message: 'El resultado no se guardó en el historial. No se enviaron notificaciones. Conserve el PDF y verifique el servicio antes de repetir el estudio.' }
    console.error('[predict] no se pudo persistir el análisis:', e)
    return Response.json(prediction)
  }
}
