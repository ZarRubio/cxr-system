import 'server-only'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { CXRUser } from './types'

/**
 * Base de datos SQLite del frontend (usuarios).
 *
 * - Desarrollo / docker-compose: persiste en data/cxr.db (montar volumen).
 * - Cloud Run: el filesystem es efímero — la BD se recrea al reiniciar la
 *   instancia y el seed garantiza que siempre exista el usuario admin.
 */

const dataDir = process.env.CXR_DATA_DIR ?? join(process.cwd(), 'data')
const dbPath = join(dataDir, 'cxr.db')
const legacyUsersPath = join(dataDir, 'users.json')

let db: Database.Database | null = null

function seedFromLegacyJson(database: Database.Database): number {
  if (!existsSync(legacyUsersPath)) return 0
  try {
    const users: CXRUser[] = JSON.parse(readFileSync(legacyUsersPath, 'utf-8'))
    const insert = database.prepare(
      `INSERT OR IGNORE INTO users (id, name, username, password, role, cmp, specialty, active, createdAt)
       VALUES (@id, @name, @username, @password, @role, @cmp, @specialty, @active, @createdAt)`,
    )
    const tx = database.transaction((rows: CXRUser[]) => {
      for (const u of rows) {
        insert.run({
          ...u,
          cmp: u.cmp ?? null,
          specialty: u.specialty ?? null,
          active: u.active ? 1 : 0,
        })
      }
    })
    tx(users)
    return users.length
  } catch {
    return 0
  }
}

function seedDefaultAdmin(database: Database.Database): void {
  const count = (database.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  if (count > 0) return
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'hnal2026'
  database
    .prepare(
      `INSERT INTO users (id, name, username, password, role, cmp, specialty, active, createdAt)
       VALUES (?, ?, ?, ?, 'admin', NULL, 'Administración del sistema', 1, ?)`,
    )
    .run('usr_admin', 'Administrador HNAL', 'admin', bcrypt.hashSync(password, 10), new Date().toISOString())
}

export function getDb(): Database.Database {
  if (db) return db
  mkdirSync(dataDir, { recursive: true })
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      username  TEXT NOT NULL UNIQUE,
      password  TEXT NOT NULL,
      role      TEXT NOT NULL CHECK (role IN ('admin', 'radiologist')),
      cmp       TEXT,
      specialty TEXT,
      active    INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
    CREATE TABLE IF NOT EXISTS analyses (
      id        TEXT PRIMARY KEY,
      userId    TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      data      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses (userId, createdAt DESC);
  `)
  seedFromLegacyJson(db)
  seedDefaultAdmin(db)
  return db
}
