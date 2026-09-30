import { NextResponse, type NextRequest } from 'next/server'
import { getActiveSession } from '@/lib/active-session'
import { getDataStore } from '@/lib/data/store'
import { filterAnalyses, type AnalysisFilters, type AnalysisRecord, type FeedbackFilter } from '@/lib/data/analysis'
import type { Severity } from '@/lib/types'

/**
 * Historial de análisis del usuario autenticado.
 * Los administradores ven el historial completo del servicio.
 */
export async function GET(request: NextRequest) {
  const principal = await getActiveSession()
  if (!principal) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const user = principal.user
  const isAdmin = user.role === 'admin'
  const params = request.nextUrl.searchParams

  const filters: AnalysisFilters = {
    q: params.get('q') ?? undefined,
    severity: (params.get('severity') as Severity) || undefined,
    feedback: (params.get('feedback') as FeedbackFilter) || undefined,
    dateFrom: params.get('dateFrom') || undefined,
    dateTo: params.get('dateTo') || undefined,
    userName: isAdmin ? params.get('userName') || undefined : undefined,
  }
  let after: { createdAt: string; id: string } | undefined
  try {
    if (params.get('cursor')) {
      after = JSON.parse(Buffer.from(params.get('cursor')!, 'base64url').toString())
      if (!after || typeof after.createdAt !== 'string' || !Number.isFinite(Date.parse(after.createdAt)) || typeof after.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(after.id)) throw new Error('cursor')
    }
  } catch { return NextResponse.json({ error: 'Cursor no valido.' }, { status: 400 }) }
  const analyses: AnalysisRecord[] = []
  let more = false
  let scanned = 0
  // Filter across older records, but bound each HTTP request's work.
  while (scanned < 1000 && analyses.length < 100) {
    const page = await getDataStore().listAnalyses({ userId: isAdmin ? undefined : user.id, limit: 100, after })
    more = page.length === 100
    for (let index = 0; index < page.length; index++) {
      const record = page[index]
      after = { createdAt: record.createdAt, id: record.id }
      scanned++
      if (filterAnalyses([record], filters).length) analyses.push(record)
      if (analyses.length === 100) { more = index < page.length - 1 || more; break }
    }
    if (!more) break
  }

  return NextResponse.json({
    analyses,
    nextCursor: more && after ? Buffer.from(JSON.stringify(after)).toString('base64url') : null,
    isAdmin,
  })
}
