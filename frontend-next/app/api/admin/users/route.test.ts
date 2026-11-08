// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), getUserById: vi.fn(), getUserByUsername: vi.fn(), createUser: vi.fn(), getUsers: vi.fn(),
  updateUser: vi.fn(), getUsersByEmail: vi.fn(),
}))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/user-store', () => ({
  getUserById: mocks.getUserById, getUserByUsername: mocks.getUserByUsername, createUser: mocks.createUser,
  getUsers: mocks.getUsers, updateUser: mocks.updateUser,
}))
vi.mock('@/lib/data/store', () => ({ getDataStore: () => ({ getUsersByEmail: mocks.getUsersByEmail }) }))
import { POST } from './route'
import { PATCH } from './[id]/route'

const admin = { id: 'usr_admin', role: 'admin', active: true, email: 'admin@example.com' }
const radiologist = { id: 'usr_r', role: 'radiologist', active: true, email: 'radio@example.com', password: 'hash' }
const json = (body: unknown) => new Request('http://localhost/api/admin/users', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const patch = (body: unknown) => new Request('http://localhost/api/admin/users/x', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'usr_admin', role: 'admin' } })
  mocks.getUserById.mockImplementation(async (id: string) => (id === 'usr_admin' ? admin : id === 'usr_r' ? radiologist : null))
  mocks.getUserByUsername.mockResolvedValue(null)
  mocks.getUsersByEmail.mockResolvedValue([])
  mocks.updateUser.mockImplementation(async (id: string, fields: object) => ({ ...(id === 'usr_admin' ? admin : radiologist), ...fields }))
})

it('creates a radiologist without email so they register it on first login', async () => {
  const res = await POST(json({ name: 'Evaluador', username: 'g2.evaluador.c', password: 'ContraseñaSegura1' }))
  expect(res.status).toBe(201)
  expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'radiologist', email: null }))
  expect(mocks.getUsersByEmail).not.toHaveBeenCalled()
})

it('lets the administrator clear a radiologist email', async () => {
  const res = await PATCH(patch({ email: null }), { params: Promise.resolve({ id: 'usr_r' }) })
  expect(res.status).toBe(200)
  expect(mocks.updateUser).toHaveBeenCalledWith('usr_r', { email: null })
})

it('never lets the administrator email be cleared', async () => {
  const res = await PATCH(patch({ email: '' }), { params: Promise.resolve({ id: 'usr_admin' }) })
  expect(res.status).toBe(400)
  expect(mocks.updateUser).not.toHaveBeenCalled()
})
