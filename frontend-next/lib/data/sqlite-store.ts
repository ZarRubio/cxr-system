import 'server-only'
import { getDb } from '@/lib/db'
import type { CXRUser } from '@/lib/types'
import type { AnalysisFeedback, AnalysisRecord } from './analysis'
import type { DataStore } from './store'

/**
 * Persistencia en SQLite (better-sqlite3). Los análisis se guardan como JSON
 * en una sola columna: las búsquedas filtran en memoria (escala de tesis) y
 * así el esquema es idéntico al de Firestore.
 */

interface UserRow extends Omit<CXRUser, 'active'> {
  active: number
}

function toUser(row: UserRow): CXRUser {
  return { ...row, active: row.active === 1 }
}

function rowToAnalysis(row: { data: string }): AnalysisRecord {
  return JSON.parse(row.data) as AnalysisRecord
}

export const sqliteStore: DataStore = {
  async getUsers() {
    const rows = getDb().prepare('SELECT * FROM users ORDER BY createdAt').all() as UserRow[]
    return rows.map(toUser)
  },

  async getUserByUsername(username) {
    const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
    return row ? toUser(row) : null
  },

  async getUserById(id) {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
    return row ? toUser(row) : null
  },

  async createUser(user) {
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
  },

  async updateUser(id, fields) {
    const current = await this.getUserById(id)
    if (!current) return null
    const next = { ...current, ...fields }
    getDb()
      .prepare('UPDATE users SET name = ?, password = ?, cmp = ?, specialty = ?, active = ? WHERE id = ?')
      .run(next.name, next.password, next.cmp ?? null, next.specialty ?? null, next.active ? 1 : 0, id)
    return this.getUserById(id)
  },

  async deleteUser(id) {
    const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id)
    return result.changes > 0
  },

  async createAnalysis(record) {
    getDb()
      .prepare('INSERT INTO analyses (id, userId, createdAt, data) VALUES (?, ?, ?, ?)')
      .run(record.id, record.userId, record.createdAt, JSON.stringify(record))
  },

  async getAnalysis(id) {
    const row = getDb().prepare('SELECT data FROM analyses WHERE id = ?').get(id) as { data: string } | undefined
    return row ? rowToAnalysis(row) : null
  },

  async listAnalyses({ userId, limit = 500 }) {
    const rows = (
      userId
        ? getDb().prepare('SELECT data FROM analyses WHERE userId = ? ORDER BY createdAt DESC LIMIT ?').all(userId, limit)
        : getDb().prepare('SELECT data FROM analyses ORDER BY createdAt DESC LIMIT ?').all(limit)
    ) as Array<{ data: string }>
    return rows.map(rowToAnalysis)
  },

  async setAnalysisFeedback(id, feedback: AnalysisFeedback) {
    const current = await this.getAnalysis(id)
    if (!current) return null
    const next: AnalysisRecord = { ...current, feedback }
    getDb().prepare('UPDATE analyses SET data = ? WHERE id = ?').run(JSON.stringify(next), id)
    return next
  },
}
