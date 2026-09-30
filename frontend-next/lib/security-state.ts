import 'server-only'
import { createHash } from 'node:crypto'
import { getDb } from './db'
import { fsMutateSecurity } from './data/firestore-rest'

export interface PasswordChange { id: string; previousPassword: string; email: string; password: string }
export interface SecurityMutation<T> {
  data: Record<string, unknown>
  result: T
  passwordChange?: PasswordChange
}

export function securityId(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** The state and optional password change commit together, including across Cloud Run instances. */
export async function mutateSecurity<T>(key: string, change: (current: Record<string, unknown>) => SecurityMutation<T>): Promise<T> {
  const id = securityId(key)
  if (process.env.DATA_BACKEND === 'firestore') return fsMutateSecurity(id, change)
  const db = getDb()
  return db.transaction(() => {
    const row = db.prepare('SELECT data FROM security_state WHERE id = ?').get(id) as { data: string } | undefined
    const next = change(row ? JSON.parse(row.data) : {})
    if (next.passwordChange) {
      const p = next.passwordChange
      const updated = db.prepare('UPDATE users SET password = ? WHERE id = ? AND password = ? AND lower(email) = ? AND active = 1')
        .run(p.password, p.id, p.previousPassword, p.email)
      if (updated.changes !== 1) throw new Error('La cuenta ha cambiado. Solicite otro codigo.')
    }
    db.prepare('INSERT INTO security_state(id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
      .run(id, JSON.stringify(next.data))
    return next.result
  })()
}

export async function consumeLimit(key: string, maximum: number, windowMs: number, now = Date.now()): Promise<boolean> {
  return mutateSecurity(`limit:${key}`, current => {
    const active = Number(current.expiresAt) > now
    const count = active ? Number(current.count ?? 0) : 0
    return { data: { count: Math.min(count + 1, maximum + 1), expiresAt: active ? current.expiresAt : now + windowMs }, result: count < maximum }
  })
}
