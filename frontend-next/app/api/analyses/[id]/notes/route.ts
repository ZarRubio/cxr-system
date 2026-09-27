import { getActiveSession } from '@/lib/active-session'
import { getDataStore } from '@/lib/data/store'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getActiveSession()
  if (!principal) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  const { id } = await params
  const store = getDataStore()
  try {
    const record = await store.getAnalysis(id)
    if (!record) return Response.json({ error: 'Estudio no encontrado.' }, { status: 404 })
    if (record.userId !== principal.user.id) return Response.json({ error: 'Solo el autor puede editar las observaciones.' }, { status: 403 })
    const body = await req.json().catch(() => null)
    if (typeof body?.notes !== 'string' || body.notes.length > 5000) {
      return Response.json({ error: 'Las observaciones deben tener como máximo 5000 caracteres.' }, { status: 400 })
    }
    const updated = await store.setAnalysisNotes(id, body.notes)
    if (!updated) return Response.json({ error: 'Estudio no encontrado.' }, { status: 404 })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'No se pudieron guardar las observaciones. Intente nuevamente.' }, { status: 503 })
  }
}
