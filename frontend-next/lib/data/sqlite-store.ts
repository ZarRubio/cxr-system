import 'server-only'
import { getDb } from '@/lib/db'
import type { CXRUser } from '@/lib/types'
import { nextEmailRetry, type AnalysisFeedback, type AnalysisRecord } from './analysis'
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

  async getUsersByEmail(email) {
    return (getDb().prepare('SELECT * FROM users WHERE lower(email) = ? LIMIT 2').all(email) as UserRow[]).map(toUser)
  },

  async createUser(user) {
    getDb().transaction(() => {
    if (user.email && getDb().prepare('SELECT id FROM users WHERE lower(email) = ?').get(user.email.toLowerCase())) throw new Error('Cuenta duplicada.')
    if (getDb().prepare('SELECT id FROM users WHERE lower(username) = ?').get(user.username.toLowerCase())) throw new Error('Cuenta duplicada.')
    getDb()
      .prepare(
        `INSERT INTO users (id, name, username, password, role, cmp, specialty, active, createdAt, email)
         VALUES (@id, @name, @username, @password, @role, @cmp, @specialty, @active, @createdAt, @email)`,
      )
      .run({
        ...user,
        email: user.email ?? null,
        cmp: user.cmp ?? null,
        specialty: user.specialty ?? null,
        active: user.active ? 1 : 0,
      })
    })()
  },

  async updateUser(id, fields) {
    const current = await this.getUserById(id)
    if (!current) return null
    const next = { ...current, ...fields }
    getDb().transaction(() => {
    if (next.email && getDb().prepare('SELECT id FROM users WHERE lower(email) = ? AND id != ?').get(next.email.toLowerCase(), id)) throw new Error('Cuenta duplicada.')
    getDb()
      .prepare('UPDATE users SET name = ?, password = ?, cmp = ?, specialty = ?, active = ?, email = ? WHERE id = ?')
      .run(next.name, next.password, next.cmp ?? null, next.specialty ?? null, next.active ? 1 : 0, next.email ?? null, id)
    })()
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

  async claimEmailAlert(id, alert) {
    return getDb().transaction(() => {
      const row = getDb().prepare('SELECT data FROM analyses WHERE id = ?').get(id) as { data: string } | undefined
      if (!row) return false
      const record = rowToAnalysis(row)
      if (record.emailAlert) return false
      getDb().prepare('UPDATE analyses SET data = ? WHERE id = ?').run(JSON.stringify({ ...record, emailAlert: alert }), id)
      return true
    })()
  },

  async claimEmailRetry(id, role, now) {
    return getDb().transaction(() => {
      const row = getDb().prepare('SELECT data FROM analyses WHERE id = ?').get(id) as { data: string } | undefined
      if (!row) return null
      const record = rowToAnalysis(row)
      if (!record.emailAlert) return null
      const next = nextEmailRetry(record.emailAlert, role, now)
      if (!next) return null
      getDb().prepare("UPDATE analyses SET data = json_set(data, '$.emailAlert', json(?)) WHERE id = ?")
        .run(JSON.stringify(next), id)
      return next
    })()
  },

  async setEmailAlert(id, alert) {
    getDb().prepare("UPDATE analyses SET data = json_set(data, '$.emailAlert', json(?)) WHERE id = ?")
      .run(JSON.stringify(alert), id)
  },

  async setEmailDelivery(id, role, delivery) {
    const path = role === 'admin' ? '$.emailAlert.admin' : '$.emailAlert.radiologist'
    getDb().prepare('UPDATE analyses SET data = json_set(data, ?, json(?)) WHERE id = ?')
      .run(path, JSON.stringify(delivery), id)
  },

  async listAnalyses({ userId, limit = 500, after }) {
    if (after) {
      const clause = userId ? 'userId = ? AND ' : ''
      const args = [...(userId ? [userId] : []), after.createdAt, after.createdAt, after.id, limit]
      return (getDb().prepare(`SELECT data FROM analyses WHERE ${clause}(createdAt < ? OR (createdAt = ? AND id < ?)) ORDER BY createdAt DESC, id DESC LIMIT ?`).all(...args) as Array<{ data: string }>).map(rowToAnalysis)
    }
    const rows = (
      userId
        ? getDb().prepare('SELECT data FROM analyses WHERE userId = ? ORDER BY createdAt DESC, id DESC LIMIT ?').all(userId, limit)
        : getDb().prepare('SELECT data FROM analyses ORDER BY createdAt DESC, id DESC LIMIT ?').all(limit)
    ) as Array<{ data: string }>
    return rows.map(rowToAnalysis)
  },

  async setAnalysisFeedback(id, feedback: AnalysisFeedback) {
    getDb().prepare("UPDATE analyses SET data = json_set(data, '$.feedback', json(?)) WHERE id = ?")
      .run(JSON.stringify(feedback), id)
    return this.getAnalysis(id)
  },
  async setAnalysisNotes(id, notes) {
    getDb().prepare("UPDATE analyses SET data = json_set(data, '$.notes', ?, '$.notesUpdatedAt', ?) WHERE id = ?")
      .run(notes, new Date().toISOString(), id)
    return this.getAnalysis(id)
  },
}
