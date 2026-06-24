import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import bcrypt from 'bcryptjs'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { CXRUser } from '@/lib/types'

const usersPath = join(process.cwd(), 'data', 'users.json')

function readUsers(): CXRUser[] {
  try {
    return JSON.parse(readFileSync(usersPath, 'utf-8'))
  } catch {
    return []
  }
}

function writeUsers(users: CXRUser[]) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8')
}

export async function GET() {
  const session = await auth()
  if (!session || (session.user as Record<string,unknown>).role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const users = readUsers().map(({ password: _p, ...u }) => u)
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || (session.user as Record<string,unknown>).role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { name, username, password, cmp, specialty } = body

  if (!name || !username || !password) {
    return NextResponse.json({ error: 'Nombre, usuario y contraseña son obligatorios.' }, { status: 400 })
  }

  const users = readUsers()
  if (users.find((u) => u.username === username)) {
    return NextResponse.json({ error: 'El nombre de usuario ya existe.' }, { status: 409 })
  }

  const hashed: CXRUser = {
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

  writeUsers([...users, hashed])
  const { password: _p, ...safe } = hashed
  return NextResponse.json(safe, { status: 201 })
}
