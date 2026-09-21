import { NextResponse, type NextRequest } from 'next/server'
import { getActiveSession } from '@/lib/active-session'
import { getDataStore } from '@/lib/data/store'
import { filterAnalyses, type AnalysisFilters, type FeedbackFilter } from '@/lib/data/analysis'
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
  }

  const analyses = await getDataStore().listAnalyses({
    userId: isAdmin ? undefined : user.id,
    limit: 500,
  })

  return NextResponse.json({
    analyses: filterAnalyses(analyses, filters),
    isAdmin,
  })
}
