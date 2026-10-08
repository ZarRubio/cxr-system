// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ request: vi.fn(), confirm: vi.fn() }))
vi.mock('@/lib/password-recovery', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/password-recovery')>(),
  requestPasswordRecovery: mocks.request,
  completePasswordRecovery: mocks.confirm,
}))
vi.mock('next/server', () => ({ after: vi.fn() }))
import { RecoveryRequestError } from '@/lib/password-recovery'
import { POST } from './route'

beforeEach(() => vi.clearAllMocks())

function request() {
  return new Request('http://localhost/api/auth/recovery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'request', email: 'unknown@example.com' }),
  })
}

describe('recovery request response', () => {
  it('returns the unregistered error without a request ID', async () => {
    mocks.request.mockRejectedValue(new RecoveryRequestError('El correo no esta registrado en una cuenta activa.', 400))
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ message: 'El correo no esta registrado en una cuenta activa.' })
  })
  it('returns rate limiting without opening a challenge', async () => {
    mocks.request.mockRejectedValue(new RecoveryRequestError('Espere un minuto antes de solicitar otro codigo.', 429))
    const response = await POST(request())
    expect(response.status).toBe(429)
    expect(await response.json()).not.toHaveProperty('requestId')
  })
  it('returns a request ID for an accepted registered account', async () => {
    mocks.request.mockResolvedValue('test-request-id')
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toHaveProperty('requestId', 'test-request-id')
  })
})
