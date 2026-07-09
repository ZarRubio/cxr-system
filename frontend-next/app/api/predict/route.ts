import type { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { backendHeaders, backendUrl, passthrough } from '@/lib/backend'
import { getDataStore } from '@/lib/data/store'
import { buildAnalysisRecord } from '@/lib/data/analysis'
import type { Prediction } from '@/lib/types'

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
  const session = await auth()
  if (!session) {
    return Response.json({ detail: 'No autorizado.' }, { status: 401 })
  }

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const headers = new Headers(backendHeaders(clientIp))
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('Content-Type', contentType)

  // Body bufferizado (máx. 15 MB por CXR_MAX_UPLOAD_MB): un stream no es
  // re-enviable y rompe cuando undici reintenta (p.ej. localhost ::1 -> 127.0.0.1).
  const body = await request.arrayBuffer()

  const res = await fetch(backendUrl('/predict', request.nextUrl.searchParams.toString()), {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(280_000),
  })

  if (!res.ok) return passthrough(res)

  // Predicción exitosa: persistir en el historial clínico antes de responder.
  // Si el guardado falla, la predicción se devuelve igual (sin analysis_id).
  const prediction = (await res.json()) as Prediction
  const user = session.user as Record<string, unknown>
  const record = buildAnalysisRecord(
    { id: String(user.id ?? ''), name: String(user.name ?? '') },
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
    return Response.json({ ...prediction, analysis_id: record.id })
  } catch (e) {
    console.error('[predict] no se pudo persistir el análisis:', e)
    return Response.json(prediction)
  }
}
