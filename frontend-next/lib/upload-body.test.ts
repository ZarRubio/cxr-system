// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readBoundedBody, UploadLimitError } from './upload-body'

describe('bounded uploads', () => {
  it('reads small bodies', async () => {
    const body = await readBoundedBody(new Request('http://localhost', { method: 'POST', body: 'abc' }), 3)
    expect(new TextDecoder().decode(body)).toBe('abc')
  })
  it('rejects declared oversize before reading', async () => {
    await expect(readBoundedBody(new Request('http://localhost', { method: 'POST', headers: { 'content-length': '100' }, body: 'abc' }), 3)).rejects.toBeInstanceOf(UploadLimitError)
  })
  it('rejects chunked uploads without Content-Length', async () => {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4)); controller.close() } })
    const req = new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit)
    await expect(readBoundedBody(req, 3)).rejects.toBeInstanceOf(UploadLimitError)
  })
})
