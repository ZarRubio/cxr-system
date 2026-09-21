import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), getUserById: vi.fn() }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/user-store', () => ({ getUserById: mocks.getUserById }))

import { getActiveSession } from './active-session'

const session = { user: { id: 'usr_1', name: 'Radiólogo' }, expires: '2099-01-01' }
const user = {
  id: 'usr_1',
  name: 'Radiólogo',
  username: 'radio',
  password: 'hash',
  role: 'radiologist',
  cmp: '12345',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue(session)
  mocks.getUserById.mockResolvedValue(user)
})

describe('getActiveSession', () => {
  it('returns the current session and active database user', async () => {
    expect(await getActiveSession()).toEqual({ session, user })
    expect(mocks.getUserById).toHaveBeenCalledWith('usr_1')
  })

  it('rejects anonymous sessions without querying the store', async () => {
    mocks.auth.mockResolvedValue(null)
    expect(await getActiveSession()).toBeNull()
    expect(mocks.getUserById).not.toHaveBeenCalled()
  })

  it('rejects a JWT whose user was disabled after login', async () => {
    mocks.getUserById.mockResolvedValue({ ...user, active: false })
    expect(await getActiveSession()).toBeNull()
  })

  it('rejects a JWT whose user no longer exists', async () => {
    mocks.getUserById.mockResolvedValue(null)
    expect(await getActiveSession()).toBeNull()
  })
})
