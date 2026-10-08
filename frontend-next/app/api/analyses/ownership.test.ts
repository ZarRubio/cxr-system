// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getActiveSession: vi.fn(), getAnalysis: vi.fn(), listAnalyses: vi.fn(),
  setAnalysisNotes: vi.fn(), setAnalysisFeedback: vi.fn(), retryCriticalEmail: vi.fn(),
}))
vi.mock('@/lib/active-session', () => ({ getActiveSession: mocks.getActiveSession }))
vi.mock('@/lib/data/store', () => ({ getDataStore: () => mocks }))
vi.mock('@/lib/critical-email', () => ({ retryCriticalEmail: mocks.retryCriticalEmail, EmailRetryError: class extends Error {} }))
import { GET } from './route'
import { PUT as notes } from './[id]/notes/route'
import { PUT as feedback } from './[id]/feedback/route'
import { POST as retry } from './[id]/retry-email/route'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getActiveSession.mockResolvedValue({ user: { id: 'account-b', role: 'radiologist' } })
  mocks.getAnalysis.mockResolvedValue({ id: 'study-a', userId: 'account-a' })
  mocks.listAnalyses.mockResolvedValue([])
})

const context = () => ({ params: Promise.resolve({ id: 'study-a' }) })
const request = (body: unknown, method = 'PUT') => new Request('http://localhost/api/analyses/study-a', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

it('restricts the list to the authenticated user despite forged owner filters', async () => {
  const response = await GET(new NextRequest('http://localhost/api/analyses?userId=account-a&userName=Owner'))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ analyses: [], isAdmin: false })
  expect(mocks.listAnalyses).toHaveBeenCalledWith(expect.objectContaining({ userId: 'account-b' }))
})

it('denies direct edits of another account notes without mutating storage', async () => {
  expect((await notes(request({ notes: 'unauthorized' }), context())).status).toBe(403)
  expect(mocks.setAnalysisNotes).not.toHaveBeenCalled()
})

it('denies direct validation of another account study without mutating storage', async () => {
  expect((await feedback(request({ agrees: true }), context())).status).toBe(403)
  expect(mocks.setAnalysisFeedback).not.toHaveBeenCalled()
})

it('denies resending alerts for another account study without sending email', async () => {
  expect((await retry(request({ role: 'radiologist' }, 'POST'), context())).status).toBe(403)
  expect(mocks.retryCriticalEmail).not.toHaveBeenCalled()
})

it('requires authentication for all study mutation endpoints', async () => {
  mocks.getActiveSession.mockResolvedValue(null)
  expect((await notes(request({ notes: 'unauthorized' }), context())).status).toBe(401)
  expect((await feedback(request({ agrees: true }), context())).status).toBe(401)
  expect((await retry(request({ role: 'radiologist' }, 'POST'), context())).status).toBe(401)
  expect(mocks.getAnalysis).not.toHaveBeenCalled()
})
