import 'server-only'
import { getDb } from './db'
import type { CXRUser } from './types'

/** CRUD de usuarios sobre SQLite. Toda lectura/escritura de usuarios pasa por aquí. */

interface UserRow extends Omit<CXRUser, 'active'> {
  active: number
}

function toUser(row: UserRow): CXRUser {
  return { ...row, active: row.active === 1 }
}

export function getUsers(): CXRUser[] {
  const rows = getDb().prepare('SELECT * FROM users ORDER BY createdAt').all() as UserRow[]
  return rows.map(toUser)
}

export function getUserByUsername(username: string): CXRUser | null {
  const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
  return row ? toUser(row) : null
}

export function getUserById(id: string): CXRUser | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  return row ? toUser(row) : null
}

export function createUser(user: CXRUser): void {
  getDb()
    .prepare(
      `INSERT INTO users (id, name, username, password, role, cmp, specialty, active, createdAt)
       VALUES (@id, @name, @username, @password, @role, @cmp, @specialty, @active, @createdAt)`,
    )
    .run({
      ...user,
      cmp: user.cmp ?? null,
      specialty: user.specialty ?? null,
      active: user.active ? 1 : 0,
    })
}

export function updateUser(id: string, fields: Partial<Pick<CXRUser, 'name' | 'cmp' | 'specialty' | 'active' | 'password'>>): CXRUser | null {
  const current = getUserById(id)
  if (!current) return null
  const next = { ...current, ...fields }
  getDb()
    .prepare(
      `UPDATE users SET name = ?, password = ?, cmp = ?, specialty = ?, active = ? WHERE id = ?`,
    )
    .run(next.name, next.password, next.cmp ?? null, next.specialty ?? null, next.active ? 1 : 0, id)
  return getUserById(id)
}

export function deleteUser(id: string): boolean {
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id)
  return result.changes > 0
}
