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

  const res = await fetch(backendUrl('/predict', request.nextUrl.searchParams.toString()), {
    method: 'POST',
    headers,
    body: request.body,
    // @ts-expect-error: duplex es requerido por undici para streams de request
    duplex: 'half',
    signal: AbortSignal.timeout(280_000),
  })
  return passthrough(res)
}
