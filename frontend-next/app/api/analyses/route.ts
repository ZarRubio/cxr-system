import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getDataStore } from '@/lib/data/store'
import { filterAnalyses, type AnalysisFilters, type FeedbackFilter } from '@/lib/data/analysis'
import type { Severity } from '@/lib/types'

/**
 * Historial de análisis del usuario autenticado.
 * Los administradores ven el historial completo del servicio.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const user = session.user as Record<string, unknown>
  const isAdmin = user.role === 'admin'
  const params = request.nextUrl.searchParams

  const filters: AnalysisFilters = {
    q: params.get('q') ?? undefined,
    severity: (params.get('severity') as Severity) || undefined,
    feedback: (params.get('feedback') as FeedbackFilter) || undefined,
  }

  const analyses = await getDataStore().listAnalyses({
    userId: isAdmin ? undefined : String(user.id ?? ''),
    limit: 500,
  })

  return NextResponse.json({
    analyses: filterAnalyses(analyses, filters),
    isAdmin,
  })
}
