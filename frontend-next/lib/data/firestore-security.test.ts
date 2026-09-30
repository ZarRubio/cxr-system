// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fsMutateSecurity, fsCreateUser, fsQuery } from './firestore-rest'

const fetchMock = vi.fn()
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/project/project-id')) return new Response('test-project')
    if (url.includes('/service-accounts/default/token')) return response({ access_token: 'test-token', expires_in: 3600 })
    if (url.endsWith(':commit')) return response({ writeResults: [] })
    if (url.includes('/security_state/')) return response({}, 404)
    if (url.includes('/users/')) return response({ fields: { password: { stringValue: 'old' }, email: { stringValue: 'radio@example.com' }, active: { booleanValue: true } }, updateTime: '2026-09-30T12:00:00Z' })
    if (url.endsWith(':runQuery')) return response([])
    throw new Error(`Unexpected request: ${url}`)
  })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('Firestore atomic security', () => {
  it('commits code consumption and password update with document preconditions', async () => {
    await fsMutateSecurity('challenge', () => ({ data: { consumed: true, expiresAt: Date.now() }, result: true,
      passwordChange: { id: 'radio', previousPassword: 'old', email: 'radio@example.com', password: 'new-hash' } }))
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith(':commit'))!
    const writes = JSON.parse(call[1].body).writes
    expect(writes).toHaveLength(2)
    expect(writes[0].currentDocument).toEqual({ exists: false })
    expect(writes[1].currentDocument.updateTime).toBeTruthy()
    expect(writes[1].update.fields.password.stringValue).toBe('new-hash')
  })
  it('retries a competing writer instead of overwriting its state', async () => {
    let commits = 0
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/security_state/')) return response({ fields: { count: { integerValue: '2' } }, updateTime: 'stamp' })
      if (url.endsWith(':commit')) return ++commits === 1 ? response({ error: { status: 'FAILED_PRECONDITION' } }, 400) : response({})
      throw new Error(url)
    })
    const result = await fsMutateSecurity('counter', current => ({ data: { count: Number(current.count) + 1 }, result: Number(current.count) + 1 }))
    expect(result).toBe(3)
    expect(commits).toBe(2)
  })
  it('creates unique username and email reservations in the same user commit', async () => {
    await fsCreateUser({ id: 'radio', username: 'radio', email: 'radio@example.com' })
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith(':commit'))!
    expect(JSON.parse(call[1].body).writes).toHaveLength(3)
  })
  it('uses a stable timestamp/document cursor for historical queries', async () => {
    await fsQuery({ collection: 'analyses', after: { createdAt: '2026-09-30T12:00:00Z', id: 'study-1' }, limit: 100 })
    const call = fetchMock.mock.calls.find(([url]) => url.endsWith(':runQuery'))!
    const query = JSON.parse(call[1].body).structuredQuery
    expect(query.orderBy[1].field.fieldPath).toBe('__name__')
    expect(query.startAt.before).toBe(false)
    expect(query.startAt.values[1].referenceValue).toContain('/analyses/study-1')
  })
})
