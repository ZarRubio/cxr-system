import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDataStore } from '@/lib/data/store'
import type { AnalysisFeedback } from '@/lib/data/analysis'

/**
 * Registra la validación del radiólogo sobre un análisis: concordancia o
 * discrepancia (con el hallazgo real). Solo el autor del análisis puede
 * registrar o corregir su feedback.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const store = getDataStore()
  const analysis = await store.getAnalysis(id)
  if (!analysis) {
    return NextResponse.json({ error: 'Análisis no encontrado.' }, { status: 404 })
  }

  const user = session.user as Record<string, unknown>
  if (analysis.userId !== String(user.id ?? '')) {
    return NextResponse.json(
      { error: 'Solo el radiólogo que realizó el análisis puede validarlo.' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.agrees !== 'boolean') {
    return NextResponse.json({ error: 'Campo "agrees" (boolean) es obligatorio.' }, { status: 400 })
  }

  const actualFinding = typeof body.actualFinding === 'string' ? body.actualFinding.trim().slice(0, 120) : ''
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) : ''

  if (!body.agrees && !actualFinding) {
    return NextResponse.json(
      { error: 'Al discrepar debe indicarse el hallazgo real.' },
      { status: 400 },
    )
  }

  const feedback: AnalysisFeedback = {
    agrees: body.agrees,
    actualFinding: body.agrees ? null : actualFinding,
    comment: comment || null,
    createdAt: new Date().toISOString(),
  }

  const updated = await store.setAnalysisFeedback(id, feedback)
  return NextResponse.json(updated)
}
