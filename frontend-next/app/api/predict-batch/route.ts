import type { NextRequest } from 'next/server'
import { getActiveSession } from '@/lib/active-session'
import { backendHeaders, backendUrl, passthrough } from '@/lib/backend'
import { getDataStore } from '@/lib/data/store'
import { buildAnalysisRecord } from '@/lib/data/analysis'
import type { Prediction } from '@/lib/types'
import { notifyCriticalAnalysis } from '@/lib/critical-email'

export const maxDuration = 300

interface BatchItem {
  filename: string
  result: (Prediction & { analysis_id?: string }) | null
  error: string | null
}

export async function POST(request: NextRequest) {
  const principal = await getActiveSession()
  if (!principal) {
    return Response.json({ detail: 'No autorizado.' }, { status: 401 })
  }

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const headers = new Headers(backendHeaders(clientIp))
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('Content-Type', contentType)

  // Body bufferizado: un stream no es re-enviable y rompe cuando undici
  // reintenta (p.ej. localhost ::1 -> 127.0.0.1).
  const body = await request.arrayBuffer()

  const res = await fetch(backendUrl('/predict-batch', request.nextUrl.searchParams.toString()), {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(280_000),
  })

  if (!res.ok) return passthrough(res)

  // Persistir cada análisis exitoso del lote en el historial clínico,
  // todos con el mismo ID de lote para trazabilidad.
  const data = (await res.json()) as { results: BatchItem[]; processing_time_ms: number; batch_id?: string }
  const store = getDataStore()

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const batchId = `LOTE-${stamp}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  data.batch_id = batchId

  await Promise.all((data.results ?? []).map(async (item) => {
    if (!item.result) return
    const record = buildAnalysisRecord(
      { id: principal.user.id, name: principal.user.name },
      item.result,
      { filename: item.filename || 'imagen', batchId },
    )
    try {
      await store.createAnalysis(record)
      item.result.analysis_id = record.id
      try {
        item.result.email_alert = await notifyCriticalAnalysis(record)
      } catch {
        console.error('[predict-batch] no se pudo completar la alerta', { analysisId: record.id })
      }
    } catch (e) {
      console.error('[predict-batch] no se pudo persistir el análisis:', e)
    }
  }))

  return Response.json(data)
}
