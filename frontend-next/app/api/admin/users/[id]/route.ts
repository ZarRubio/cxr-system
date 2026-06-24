import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { readFileSync, writeFileSync } from 'fs'
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || (session.user as Record<string,unknown>).role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const body   = await req.json()
  const users  = readUsers()
  const idx    = users.findIndex((u) => u.id === id)

  if (idx === -1) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  if (users[idx].role === 'admin') {
    return NextResponse.json({ error: 'No se puede modificar al administrador.' }, { status: 403 })
  }

  users[idx] = { ...users[idx], ...body }
  writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8')

  const { password: _p, ...safe } = users[idx]
  return NextResponse.json(safe)
}
