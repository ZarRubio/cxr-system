import { getActiveSession } from '@/lib/active-session'
import { getDataStore } from '@/lib/data/store'

/**
 * Elimina un estudio del historial para atender el derecho de cancelación (Ley 29733).
 * Solo un administrador activo puede hacerlo; la acción queda en el log del servidor
 * con el identificador del estudio y del administrador, sin datos del paciente.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const principal = await getActiveSession()
  if (!principal) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  if (principal.user.role !== 'admin') {
    return Response.json({ error: 'Solo un administrador puede eliminar estudios.' }, { status: 403 })
  }
  const { id } = await params
  try {
    const deleted = await getDataStore().deleteAnalysis(id)
    if (!deleted) return Response.json({ error: 'Estudio no encontrado.' }, { status: 404 })
    console.info('[analysis] estudio eliminado', { analysisId: id, actorId: principal.user.id, at: new Date().toISOString() })
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: 'No se pudo eliminar el estudio. Intente nuevamente.' }, { status: 503 })
  }
}
