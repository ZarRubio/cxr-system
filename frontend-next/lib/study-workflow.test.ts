import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), create: vi.fn(), get: vi.fn(), notes: vi.fn(), notify: vi.fn(), retry: vi.fn() }))
vi.mock('@/lib/active-session', () => ({ getActiveSession: mocks.session }))
vi.mock('@/lib/data/store', () => ({ getDataStore: () => ({ createAnalysis: mocks.create, getAnalysis: mocks.get, setAnalysisNotes: mocks.notes }) }))
vi.mock('@/lib/backend', () => ({ backendHeaders: () => ({}), backendUrl: () => 'http://backend/predict', passthrough: (res: Response) => res }))
vi.mock('@/lib/critical-email', () => ({ notifyCriticalAnalysis: mocks.notify, retryCriticalEmail: mocks.retry, EmailRetryError: class extends Error { status = 409 } }))
import { POST } from '@/app/api/predict/route'
import { POST as batchPost } from '@/app/api/predict-batch/route'
import { PUT } from '@/app/api/analyses/[id]/notes/route'
import { POST as retryPost } from '@/app/api/analyses/[id]/retry-email/route'
const prediction = { predicted_class: 'Pneumonia', confidence: .8, probabilities: { Pneumonia: .8 }, positive_findings: ['Pneumonia'], processing_time_ms: 10, image_hash: 'hash', model_version: 'v1', gradcam_image: 'map' }
const record = { id: 'study', userId: 'u1', imageHash: 'hash', modelVersion: 'v1' }
const request = (query = '') => new NextRequest(`http://localhost/api/predict${query}`, { method: 'POST', body: 'image' })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { id: 'u1', name: 'Test', role: 'radiologist' } })
  mocks.create.mockResolvedValue(undefined)
  mocks.get.mockResolvedValue(record)
  mocks.notify.mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(prediction)))
})

it('reports persistence failure without sending an email or losing inference', async () => {
  mocks.create.mockRejectedValue(new Error('store unavailable'))
  const result = await (await POST(request())).json()
  expect(result.predicted_class).toBe('Pneumonia')
  expect(result.persistence.status).toBe('failed')
  expect(result.analysis_id).toBeUndefined()
  expect(mocks.notify).not.toHaveBeenCalled()
})
it('separates successful saving from notification errors', async () => {
  mocks.notify.mockRejectedValue(new Error('SMTP error'))
  const result = await (await POST(request())).json()
  expect(result.persistence.status).toBe('saved')
  expect(result.analysis_id).toBeTruthy()
  expect(result.notification_error).toBe(true)
})
it('generates explanation without creating a record or sending another alert', async () => {
  const result = await (await POST(request('?explain_analysis_id=study'))).json()
  expect(result).toEqual({ gradcam_image: 'map' })
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.notify).not.toHaveBeenCalled()
})
it('rejects explanation of another user study before inference', async () => {
  mocks.get.mockResolvedValue({ ...record, userId: 'other' })
  expect((await POST(request('?explain_analysis_id=study'))).status).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
})
it('rejects a different image or model for the original study', async () => {
  mocks.get.mockResolvedValue({ ...record, imageHash: 'different' })
  expect((await POST(request('?explain_analysis_id=study'))).status).toBe(409)
  mocks.get.mockResolvedValue({ ...record, modelVersion: 'v2' })
  expect((await POST(request('?explain_analysis_id=study'))).status).toBe(409)
  expect(mocks.create).not.toHaveBeenCalled()
})
it('reports partial persistence failures for a batch', async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ results: [{ filename: 'a.png', result: { ...prediction } }, { filename: 'b.png', result: { ...prediction } }] }))
  mocks.create.mockRejectedValueOnce(new Error('failure')).mockResolvedValueOnce(undefined)
  const result = await (await batchPost(request())).json()
  expect(result.results[0].result.persistence.status).toBe('failed')
  expect(result.results[1].result.persistence.status).toBe('saved')
  expect(mocks.notify).toHaveBeenCalledTimes(1)
})
const notesRequest = (notes: unknown) => new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ notes }) })
const params = { params: Promise.resolve({ id: 'study' }) }
it('saves notes only for the author', async () => {
  mocks.notes.mockResolvedValue({ ...record, notes: 'Observation' })
  expect((await PUT(notesRequest('Observation'), params)).status).toBe(200)
  expect(mocks.notes).toHaveBeenCalledWith('study', 'Observation')
  mocks.get.mockResolvedValue({ ...record, userId: 'another' })
  expect((await PUT(notesRequest('changed'), params)).status).toBe(403)
  expect(mocks.notes).toHaveBeenCalledTimes(1)
})
it('validates notes length and reports storage errors', async () => {
  expect((await PUT(notesRequest('x'.repeat(5001)), params)).status).toBe(400)
  expect((await PUT(notesRequest(12), params)).status).toBe(400)
  mocks.notes.mockRejectedValue(new Error('offline'))
  expect((await PUT(notesRequest('valid'), params)).status).toBe(503)
})
it('rejects anonymous requests', async () => {
  mocks.session.mockResolvedValue(null)
  expect((await POST(request())).status).toBe(401)
  expect((await PUT(notesRequest('valid'), params)).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it('allows only the owner to retry their own recipient; an admin may retry either', async () => {
  const emailRequest = (role: string) => new Request('http://localhost', { method: 'POST', body: JSON.stringify({ role }) })
  expect((await retryPost(emailRequest('admin'), params)).status).toBe(403)
  expect((await retryPost(emailRequest('radiologist'), params)).status).toBe(200)
  expect(mocks.retry).toHaveBeenCalledTimes(1)
  mocks.session.mockResolvedValue({ user: { id: 'admin', role: 'admin' } })
  expect((await retryPost(emailRequest('admin'), params)).status).toBe(200)
  mocks.get.mockResolvedValue({ ...record, userId: 'other' })
  mocks.session.mockResolvedValue({ user: { id: 'u1', role: 'radiologist' } })
  expect((await retryPost(emailRequest('radiologist'), params)).status).toBe(403)
  expect((await retryPost(emailRequest('invalid'), params)).status).toBe(400)
})
