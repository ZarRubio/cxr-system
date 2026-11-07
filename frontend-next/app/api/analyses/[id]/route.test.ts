// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getActiveSession: vi.fn(), deleteAnalysis: vi.fn() }))
vi.mock('@/lib/active-session', () => ({ getActiveSession: mocks.getActiveSession }))
vi.mock('@/lib/data/store', () => ({ getDataStore: () => mocks }))
import { DELETE } from './route'

const context = () => ({ params: Promise.resolve({ id: 'study-a' }) })
const request = () => new Request('http://localhost/api/analyses/study-a', { method: 'DELETE' })

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  mocks.deleteAnalysis.mockResolvedValue(true)
})

it('rejects anonymous requests without touching the store', async () => {
  mocks.getActiveSession.mockResolvedValue(null)
  expect((await DELETE(request(), context())).status).toBe(401)
  expect(mocks.deleteAnalysis).not.toHaveBeenCalled()
})

it('does not let a radiologist delete studies, not even their own', async () => {
  mocks.getActiveSession.mockResolvedValue({ user: { id: 'account-a', role: 'radiologist' } })
  expect((await DELETE(request(), context())).status).toBe(403)
  expect(mocks.deleteAnalysis).not.toHaveBeenCalled()
})

it('lets an active administrator delete a study and logs who did it', async () => {
  mocks.getActiveSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
  const response = await DELETE(request(), context())
  expect(response.status).toBe(204)
  expect(mocks.deleteAnalysis).toHaveBeenCalledWith('study-a')
  expect(console.info).toHaveBeenCalledWith('[analysis] estudio eliminado', expect.objectContaining({ analysisId: 'study-a', actorId: 'admin-1' }))
})

it('reports a missing study as not found', async () => {
  mocks.getActiveSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
  mocks.deleteAnalysis.mockResolvedValue(false)
  expect((await DELETE(request(), context())).status).toBe(404)
})
