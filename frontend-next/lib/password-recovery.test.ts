// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUsersByEmail: vi.fn(), sendMail: vi.fn(), close: vi.fn() }))
vi.mock('./db', () => ({ getDb: mocks.getDb }))
vi.mock('./data/store', () => ({ getDataStore: () => mocks }))
vi.mock('./critical-email', () => ({ configured: () => true, transport: () => ({ sendMail: mocks.sendMail, close: mocks.close }) }))
import { requestPasswordRecovery, completePasswordRecovery, validNewPassword } from './password-recovery'
import { consumeLimit } from './security-state'

const db = new Database(':memory:')
db.exec('CREATE TABLE security_state(id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE users(id TEXT PRIMARY KEY, password TEXT, email TEXT, active INTEGER)')
const user = { id: 'radio', password: 'old-hash', email: 'radio@example.com', active: true }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('AUTH_SECRET', 'test-secret-32-characters-minimum-1234')
  vi.stubEnv('DATA_BACKEND', 'sqlite')
  mocks.getDb.mockReturnValue(db)
  mocks.getUsersByEmail.mockResolvedValue([user])
  mocks.sendMail.mockResolvedValue({ accepted: ['radio@example.com'] })
  db.exec('DELETE FROM security_state; DELETE FROM users')
  db.prepare('INSERT INTO users VALUES (?, ?, ?, 1)').run(user.id, user.password, user.email)
})
afterAll(() => { db.close(); vi.unstubAllEnvs() })

async function challenge() {
  const id = await requestPasswordRecovery(user.email, '127.0.0.1')
  const code = mocks.sendMail.mock.calls[0][0].text.match(/\b\d{6}\b/)[0]
  return { id, code }
}

describe('password recovery', () => {
  it('stores only a keyed digest, resets once and invalidates reuse', async () => {
    const { id, code } = await challenge()
    const data = (db.prepare('SELECT data FROM security_state').all() as { data: string }[]).map(row => row.data).join('')
    expect(data).not.toContain(`"code":"${code}"`)
    expect(await completePasswordRecovery(id, code, 'new-password-test-123', 'ip')).toBe(true)
    const row = db.prepare('SELECT password FROM users').get() as { password: string }
    expect(await bcrypt.compare('new-password-test-123', row.password)).toBe(true)
    expect(await completePasswordRecovery(id, code, 'second-password-test-123', 'ip')).toBe(false)
  })
  it('exhausts the code after five incorrect attempts', async () => {
    const { id, code } = await challenge()
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) expect(await completePasswordRecovery(id, wrong, 'new-password-test-123', 'ip')).toBe(false)
    expect(await completePasswordRecovery(id, code, 'new-password-test-123', 'ip')).toBe(false)
  })
  it('rejects unknown emails without creating a challenge or sending mail', async () => {
    mocks.getUsersByEmail.mockResolvedValue([])
    await expect(requestPasswordRecovery('unknown@example.com', 'ip')).rejects.toThrow('El correo no esta registrado')
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
  it('rejects disabled accounts without sending mail', async () => {
    mocks.getUsersByEmail.mockResolvedValue([{ ...user, active: false }])
    await expect(requestPasswordRecovery(user.email, 'ip')).rejects.toThrow('El correo no esta registrado')
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
  it('rejects duplicate active emails instead of selecting an account', async () => {
    mocks.getUsersByEmail.mockResolvedValue([user, { ...user, id: 'other' }])
    await expect(requestPasswordRecovery(user.email, 'ip')).rejects.toThrow('Contacte al administrador')
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })
  it('rejects repeated requests without resending mail', async () => {
    await challenge()
    await expect(requestPasswordRecovery(user.email, '127.0.0.1')).rejects.toMatchObject({ status: 429 })
    expect(mocks.sendMail).toHaveBeenCalledTimes(1)
  })
  it('rejects expired codes', async () => {
    const { id, code } = await challenge()
    db.exec("UPDATE security_state SET data = json_set(data, '$.expiresAt', 0)")
    expect(await completePasswordRecovery(id, code, 'new-password-test-123', 'ip')).toBe(false)
  })
  it('limits persistent counters and rolls the window', async () => {
    expect(await consumeLimit('test', 1, 1000, 1000)).toBe(true)
    expect(await consumeLimit('test', 1, 1000, 1100)).toBe(false)
    expect(await consumeLimit('test', 1, 1000, 2000)).toBe(true)
  })
  it('enforces new-password bounds including bcrypt byte limit', () => {
    expect(validNewPassword('short')).toBe(false)
    expect(validNewPassword('a'.repeat(73))).toBe(false)
    expect(validNewPassword('secure-long-test-password')).toBe(true)
  })
  it('only one concurrent confirmation can consume the same code', async () => {
    const { id, code } = await challenge()
    const outcomes = await Promise.all([completePasswordRecovery(id, code, 'first-password-test-123', 'ip'), completePasswordRecovery(id, code, 'second-password-test-123', 'ip')])
    expect(outcomes.filter(Boolean)).toHaveLength(1)
  })
  it('does not reset disabled or modified accounts', async () => {
    const { id, code } = await challenge()
    db.exec('UPDATE users SET active = 0')
    await expect(completePasswordRecovery(id, code, 'new-password-test-123', 'ip')).rejects.toThrow('La cuenta ha cambiado')
  })
  it('does not change the password when SMTP rejects delivery', async () => {
    mocks.sendMail.mockRejectedValue(new Error('SMTP'))
    const id = await requestPasswordRecovery(user.email, 'ip')
    const code = mocks.sendMail.mock.calls[0][0].text.match(/\b\d{6}\b/)[0]
    expect(await completePasswordRecovery(id, code, 'new-password-test-123', 'ip')).toBe(false)
    expect((db.prepare('SELECT password FROM users').get() as { password: string }).password).toBe(user.password)
  })
})
