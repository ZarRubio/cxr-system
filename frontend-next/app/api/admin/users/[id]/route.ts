import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getUserById, updateUser } from '@/lib/user-store'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || (session.user as Record<string, unknown>).role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const existing = getUserById(id)

  if (!existing) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  if (existing.role === 'admin') {
    return NextResponse.json({ error: 'No se puede modificar al administrador.' }, { status: 403 })
  }

  const body = await req.json()
  const { name, cmp, specialty, active } = body
  const updated = updateUser(id, {
    ...(name !== undefined ? { name } : {}),
    ...(cmp !== undefined ? { cmp } : {}),
    ...(specialty !== undefined ? { specialty } : {}),
    ...(active !== undefined ? { active } : {}),
  })

  if (!updated) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  const { password: _p, ...safe } = updated
  return NextResponse.json(safe)
}
