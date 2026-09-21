import type { NextRequest } from 'next/server'
import { getActiveSession } from '@/lib/active-session'
import { backendHeaders, backendUrl, passthrough } from '@/lib/backend'

export async function GET(request: NextRequest) {
  const principal = await getActiveSession()
  if (!principal) {
    return Response.json({ detail: 'No autorizado.' }, { status: 401 })
  }

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const res = await fetch(backendUrl('/model-info'), {
    headers: backendHeaders(clientIp),
    next: { revalidate: 60 },
  })
  return passthrough(res)
}
