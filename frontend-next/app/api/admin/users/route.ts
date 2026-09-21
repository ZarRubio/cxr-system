import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import bcrypt from 'bcryptjs'
import { createUser, getUserByUsername, getUsers } from '@/lib/user-store'
import type { CXRUser } from '@/lib/types'
import { parseEmail } from '@/lib/email-address'
import { getUserById } from '@/lib/user-store'

async function requireAdmin() {
  const session = await auth()
  if (!session || (session.user as Record<string, unknown>).role !== 'admin') {
    return null
  }
  const current = await getUserById(String((session.user as Record<string, unknown>).id))
  return current?.active && current.role === 'admin' ? session : null
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const users = (await getUsers()).map(({ password: _p, ...u }) => u)
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { name, username, password, cmp, specialty } = body
  let email: string | null
  try { email = parseEmail(body.email) } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }

  if (!name || !username || !password) {
    return NextResponse.json({ error: 'Nombre, usuario y contraseña son obligatorios.' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 })
  }
  if (await getUserByUsername(username)) {
    return NextResponse.json({ error: 'El nombre de usuario ya existe.' }, { status: 409 })
  }

  const user: CXRUser = {
    id:        `usr_${Date.now()}`,
    name,
    username,
    password:  await bcrypt.hash(password, 10),
    role:      'radiologist',
    email,
    cmp:       cmp || null,
    specialty: specialty || 'Radiología',
    active:    true,
    createdAt: new Date().toISOString(),
  }

  await createUser(user)
  const { password: _p, ...safe } = user
  return NextResponse.json(safe, { status: 201 })
}
