// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActiveSession: vi.fn(), createAnalysis: vi.fn(), getAnalysis: vi.fn(), notifyCriticalAnalysis: vi.fn(),
}))
vi.mock('@/lib/active-session', () => ({ getActiveSession: mocks.getActiveSession }))
vi.mock('@/lib/data/store', () => ({ getDataStore: () => ({ createAnalysis: mocks.createAnalysis, getAnalysis: mocks.getAnalysis }) }))
vi.mock('@/lib/critical-email', () => ({ notifyCriticalAnalysis: mocks.notifyCriticalAnalysis }))
vi.mock('@/lib/backend', () => ({
  backendHeaders: () => ({}),
  backendUrl: (path: string, qs: string) => `http://backend${path}?${qs}`,
  passthrough: (res: Response) => res,
}))
import { POST } from './route'
import { COMPARE_NOT_SAVED_MESSAGE } from '@/lib/constants'
import { NextRequest } from 'next/server'

const backend = vi.fn()
const prediction = { predictions: { Pneumothorax: 0.9 }, positive_findings: ['Pneumothorax'], model_version: 'v', image_hash: 'h' }
const request = (query: string) => new NextRequest(`http://localhost/api/predict?${query}`, { method: 'POST', body: 'imagen' })

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.stubGlobal('fetch', backend)
  backend.mockImplementation(async () => Response.json(prediction))
  mocks.getActiveSession.mockResolvedValue({ user: { id: 'account-a', name: 'Radióloga A', role: 'radiologist' } })
  mocks.notifyCriticalAnalysis.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())

it('compare mode returns the prediction without saving a study or sending alerts', async () => {
  const response = await POST(request('include_gradcam=true&mode=compare'))
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.persistence).toEqual({ status: 'not_saved', message: COMPARE_NOT_SAVED_MESSAGE })
  expect(body.analysis_id).toBeUndefined()
  expect(mocks.createAnalysis).not.toHaveBeenCalled()
  expect(mocks.notifyCriticalAnalysis).not.toHaveBeenCalled()
  expect(String(backend.mock.calls[0][0])).not.toContain('mode=')
  expect(console.info).toHaveBeenCalledWith('[predict] comparación sin guardar', expect.objectContaining({ actorId: 'account-a' }))
})

it('a regular analysis is still saved and checked for alerts', async () => {
  mocks.createAnalysis.mockResolvedValue(undefined)
  const body = await (await POST(request('include_gradcam=true'))).json()
  expect(mocks.createAnalysis).toHaveBeenCalledTimes(1)
  expect(mocks.notifyCriticalAnalysis).toHaveBeenCalledTimes(1)
  expect(body.persistence).toEqual({ status: 'saved' })
})

it('rejects compare mode combined with a stored-study explanation', async () => {
  expect((await POST(request('mode=compare&explain_analysis_id=study-a'))).status).toBe(400)
  expect(backend).not.toHaveBeenCalled()
})

it('rejects anonymous compare requests', async () => {
  mocks.getActiveSession.mockResolvedValue(null)
  expect((await POST(request('mode=compare'))).status).toBe(401)
  expect(backend).not.toHaveBeenCalled()
})
