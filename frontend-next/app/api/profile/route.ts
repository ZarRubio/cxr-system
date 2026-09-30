import { auth } from '@/auth'
import { getUserById, updateUser } from '@/lib/user-store'
import { parseEmail } from '@/lib/email-address'
import { getDataStore } from '@/lib/data/store'

async function currentUser() {
  const session = await auth()
  const id = (session?.user as Record<string, unknown> | undefined)?.id
  if (!id) return null
  const user = await getUserById(String(id))
  return user?.active ? user : null
}

export async function GET() {
  const user = await currentUser()
  if (!user) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  return Response.json({ email: user.email ?? null, role: user.role })
}

export async function PATCH(request: Request) {
  const user = await currentUser()
  if (!user) return Response.json({ error: 'No autorizado.' }, { status: 401 })
  let email: string | null
  try {
    email = parseEmail((await request.json()).email, true)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Correo no válido.' }, { status: 400 })
  }
  if ((await getDataStore().getUsersByEmail(email!)).some(account => account.id !== user.id)) return Response.json({ error: 'El correo ya pertenece a otra cuenta.' }, { status: 409 })
  try { await updateUser(user.id, { email }) }
  catch { return Response.json({ error: 'No se pudo actualizar el correo. Intente nuevamente.' }, { status: 409 }) }
  return Response.json({ email, role: user.role })
}
