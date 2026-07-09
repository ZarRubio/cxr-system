import type { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { backendHeaders, backendUrl, passthrough } from '@/lib/backend'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
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
  return passthrough(res)
}
