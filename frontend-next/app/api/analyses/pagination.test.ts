// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ getActiveSession: vi.fn(), listAnalyses: vi.fn() }))
vi.mock('@/lib/active-session', () => ({ getActiveSession: mocks.getActiveSession }))
vi.mock('@/lib/data/store', () => ({ getDataStore: () => mocks }))
import { GET } from './route'

const records = Array.from({ length: 650 }, (_, index) => ({ id: `study-${index}`, userId: 'radio', userName: 'Radio', studyId: `EST-${index}`, filename: 'image.png', batchId: null,
  createdAt: new Date(Date.UTC(2026, 8, 30) - index * 1000).toISOString(), predictedClass: 'Effusion', severity: 'high', feedback: null }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getActiveSession.mockResolvedValue({ user: { id: 'radio', role: 'radiologist' } })
  mocks.listAnalyses.mockImplementation(({ after, limit }) => {
    const start = after ? records.findIndex(record => record.id === after.id) + 1 : 0
    return Promise.resolve(records.slice(start, start + limit))
  })
})
describe('history pagination', () => {
  it('finds a study older than the previous 500-record cutoff', async () => {
    const response = await GET(new NextRequest('http://localhost/api/analyses?q=EST-649'))
    const data = await response.json()
    expect(data.analyses.map((r: { id: string }) => r.id)).toEqual(['study-649'])
    expect(data.nextCursor).toBeNull()
    expect(mocks.listAnalyses.mock.calls[0][0].userId).toBe('radio')
  })
  it('continues without duplicating the last record of a page', async () => {
    const first = await (await GET(new NextRequest('http://localhost/api/analyses'))).json()
    const second = await (await GET(new NextRequest(`http://localhost/api/analyses?cursor=${first.nextCursor}`))).json()
    expect(first.analyses).toHaveLength(100)
    expect(second.analyses[0].id).toBe('study-100')
  })
  it('rejects malformed cursors', async () => {
    expect((await GET(new NextRequest('http://localhost/api/analyses?cursor=garbage'))).status).toBe(400)
  })
})
