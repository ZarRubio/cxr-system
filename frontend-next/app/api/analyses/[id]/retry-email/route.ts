import { getActiveSession } from '@/lib/active-session'
import { getDataStore } from '@/lib/data/store'
import { EmailRetryError, retryCriticalEmail } from '@/lib/critical-email'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getActiveSession()
  if (!principal) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (body?.role !== 'admin' && body?.role !== 'radiologist') {
    return Response.json({ error: 'Destinatario no válido.' }, { status: 400 })
  }
  const { id } = await params
  try {
    const store = getDataStore()
    const record = await store.getAnalysis(id)
    if (!record) return Response.json({ error: 'Estudio no encontrado.' }, { status: 404 })
    if (principal.user.role !== 'admin' && (record.userId !== principal.user.id || body.role !== 'radiologist')) {
      return Response.json({ error: 'No autorizado para este destinatario.' }, { status: 403 })
    }
    await retryCriticalEmail(record, body.role)
    return Response.json({ emailAlert: (await store.getAnalysis(id))?.emailAlert })
  } catch (error) {
    if (error instanceof EmailRetryError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[retry-email] estado no confirmado', { analysisId: id })
    return Response.json({ error: 'No se pudo confirmar el envío. Consulte el estado del estudio antes de reintentar.' }, { status: 503 })
  }
}
