import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getUserById: vi.fn(), updateUser: vi.fn() }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/user-store', () => ({ getUserById: mocks.getUserById, updateUser: mocks.updateUser }))
import { GET, PATCH } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
  mocks.getUserById.mockResolvedValue({ id: 'u1', role: 'admin', active: true, email: 'admin@example.com', password: 'never-return' })
})
const request = (body: unknown) => new Request('http://localhost/api/profile', { method: 'PATCH', body: JSON.stringify(body) })

describe('profile email', () => {
  it('rejects anonymous and inactive accounts', async () => {
    mocks.auth.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
    mocks.getUserById.mockResolvedValueOnce({ id: 'u1', active: false })
    expect((await PATCH(request({ email: 'a@example.com' }))).status).toBe(401)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
  it('returns only the email and role', async () => {
    expect(await (await GET()).json()).toEqual({ email: 'admin@example.com', role: 'admin' })
  })
  it('cannot remove the admin email', async () => {
    expect((await PATCH(request({ email: '' }))).status).toBe(400)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
  it('only updates the authenticated user email, ignoring injected role/id', async () => {
    expect((await PATCH(request({ email: 'New@Example.com', id: 'another', role: 'admin' }))).status).toBe(200)
    expect(mocks.updateUser).toHaveBeenCalledWith('u1', { email: 'new@example.com' })
  })
  it('lets radiologists omit email', async () => {
    mocks.getUserById.mockResolvedValue({ id: 'u1', role: 'radiologist', active: true })
    expect((await PATCH(request({ email: '' }))).status).toBe(200)
    expect(mocks.updateUser).toHaveBeenCalledWith('u1', { email: null })
  })
})
