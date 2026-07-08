import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import bcrypt from 'bcryptjs'
import { createUser, getUserByUsername, getUsers } from '@/lib/user-store'
import type { CXRUser } from '@/lib/types'

async function requireAdmin() {
  const session = await auth()
  if (!session || (session.user as Record<string, unknown>).role !== 'admin') {
    return null
  }
  return session
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const users = getUsers().map(({ password: _p, ...u }) => u)
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { name, username, password, cmp, specialty } = body

  if (!name || !username || !password) {
    return NextResponse.json({ error: 'Nombre, usuario y contraseña son obligatorios.' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 })
  }
  if (getUserByUsername(username)) {
    return NextResponse.json({ error: 'El nombre de usuario ya existe.' }, { status: 409 })
  }

  const user: CXRUser = {
    id:        `usr_${Date.now()}`,
    name,
    username,
    password:  await bcrypt.hash(password, 10),
    role:      'radiologist',
    cmp:       cmp || null,
    specialty: specialty || 'Radiología',
    active:    true,
    createdAt: new Date().toISOString(),
  }

  createUser(user)
  const { password: _p, ...safe } = user
  return NextResponse.json(safe, { status: 201 })
}
