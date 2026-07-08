import 'server-only'
import bcrypt from 'bcryptjs'
import type { CXRUser } from '@/lib/types'
import type { AnalysisFeedback, AnalysisRecord } from './analysis'
import type { DataStore } from './store'
import { fsDeleteDoc, fsGetDoc, fsQuery, fsSetDoc, fsUpdateFields } from './firestore-rest'

/**
 * Persistencia en Firestore (colecciones `users` y `analyses`).
 * A diferencia de SQLite en Cloud Run, esto sobrevive reinicios: los usuarios
 * creados en /admin y el historial clínico son permanentes.
 */

const USERS = 'users'
const ANALYSES = 'analyses'

function toUser(doc: Record<string, unknown>): CXRUser {
  return doc as unknown as CXRUser
}

function toAnalysis(doc: Record<string, unknown>): AnalysisRecord {
  return doc as unknown as AnalysisRecord
}

/**
 * Seed idempotente del admin: si no existe el doc `usr_admin`, se crea.
 * Corre una vez por instancia, en el primer acceso a usuarios.
 */
let seedPromise: Promise<void> | null = null
function ensureSeed(): Promise<void> {
  seedPromise ??= (async () => {
    const admin = await fsGetDoc(USERS, 'usr_admin')
    if (admin) return
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'hnal2026'
    const user: CXRUser = {
      id: 'usr_admin',
      name: 'Administrador HNAL',
      username: 'admin',
      password: bcrypt.hashSync(password, 10),
      role: 'admin',
      cmp: null,
      specialty: 'Administración del sistema',
      active: true,
      createdAt: new Date().toISOString(),
    }
    await fsSetDoc(USERS, user.id, user as unknown as Record<string, unknown>)
  })().catch((e) => {
    // Permitir reintento en el siguiente acceso si el seed falló
    seedPromise = null
    throw e
  })
  return seedPromise
}

export const firestoreStore: DataStore = {
  async getUsers() {
    await ensureSeed()
    const docs = await fsQuery({
      collection: USERS,
      orderBy: { field: 'createdAt', direction: 'ASCENDING' },
      limit: 500,
    })
    return docs.map(toUser)
  },

  async getUserByUsername(username) {
    await ensureSeed()
    const docs = await fsQuery({
      collection: USERS,
      where: [{ field: 'username', op: 'EQUAL', value: username }],
      limit: 1,
    })
    return docs.length ? toUser(docs[0]) : null
  },

  async getUserById(id) {
    await ensureSeed()
    const doc = await fsGetDoc(USERS, id)
    return doc ? toUser(doc) : null
  },

  async createUser(user) {
    await fsSetDoc(USERS, user.id, {
      ...user,
      cmp: user.cmp ?? null,
      specialty: user.specialty ?? null,
    } as unknown as Record<string, unknown>)
  },

  async updateUser(id, fields) {
    const current = await this.getUserById(id)
    if (!current) return null
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
    if (Object.keys(clean).length > 0) await fsUpdateFields(USERS, id, clean)
    return this.getUserById(id)
  },

  async deleteUser(id) {
    return fsDeleteDoc(USERS, id)
  },

  async createAnalysis(record) {
    await fsSetDoc(ANALYSES, record.id, record as unknown as Record<string, unknown>)
  },

  async getAnalysis(id) {
    const doc = await fsGetDoc(ANALYSES, id)
    return doc ? toAnalysis(doc) : null
  },

  async listAnalyses({ userId, limit = 500 }) {
    const docs = await fsQuery({
      collection: ANALYSES,
      where: userId ? [{ field: 'userId', op: 'EQUAL', value: userId }] : undefined,
      orderBy: { field: 'createdAt', direction: 'DESCENDING' },
      limit,
    })
    return docs.map(toAnalysis)
  },

  async setAnalysisFeedback(id, feedback: AnalysisFeedback) {
    await fsUpdateFields(ANALYSES, id, { feedback: feedback as unknown as Record<string, unknown> })
    return this.getAnalysis(id)
  },
}
