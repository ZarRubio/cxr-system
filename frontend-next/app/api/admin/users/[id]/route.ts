import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getUserById, updateUser } from '@/lib/user-store'
import { parseEmail } from '@/lib/email-address'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || (session.user as Record<string, unknown>).role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const actor = await getUserById(String((session.user as Record<string, unknown>).id))
  if (!actor?.active || actor.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const existing = await getUserById(id)

  if (!existing) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  const body = await req.json()
  let email: string | null | undefined
  try { if ('email' in body) email = parseEmail(body.email, existing.role === 'admin') } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
  if (existing.role === 'admin') {
    if (email === undefined || Object.keys(body).some((key) => key !== 'email')) {
      return NextResponse.json({ error: 'Solo se puede modificar el correo del administrador.' }, { status: 403 })
    }
  }
  const { name, cmp, specialty, active } = body
  const updated = await updateUser(id, {
    ...(email !== undefined ? { email } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(cmp !== undefined ? { cmp } : {}),
    ...(specialty !== undefined ? { specialty } : {}),
    ...(active !== undefined ? { active } : {}),
  })

  if (!updated) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  const { password: _p, ...safe } = updated
  return NextResponse.json(safe)
}
