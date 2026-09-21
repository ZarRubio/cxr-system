import { auth } from '@/auth'
import { getUserById, updateUser } from '@/lib/user-store'
import { parseEmail } from '@/lib/email-address'

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
    email = parseEmail((await request.json()).email, user.role === 'admin')
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Correo no válido.' }, { status: 400 })
  }
  await updateUser(user.id, { email })
  return Response.json({ email, role: user.role })
}
