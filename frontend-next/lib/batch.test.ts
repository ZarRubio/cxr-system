// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type BatchResponse } from './api'
import { newBatchId, runBatchByPlate, type BatchProgress } from './batch'

const file = (name: string) => ({ bytes: new Uint8Array([1, 2, 3]), name })
const prediction = { predicted_class: 'No Finding', confidence: 0.9, probabilities: {}, positive_findings: [], processing_time_ms: 5 }
const ok = (name: string): BatchResponse => ({ results: [{ filename: name, result: prediction, error: null }], processing_time_ms: 5 })

describe('newBatchId', () => {
  it('uses the same LOTE-YYYYMMDD-nnn format the server validates', () => {
    expect(newBatchId(new Date('2026-11-25T12:00:00Z'), () => 0.0421)).toBe('LOTE-20261125-042')
    expect(newBatchId()).toMatch(/^LOTE-\d{8}-\d{3}$/)
  })
})

describe('runBatchByPlate (H12: progreso por placa)', () => {
  it('analyzes plate by plate, reports progress and shares one batch id', async () => {
    const analyze = vi.fn(async (files: { name: string }[]) => ok(files[0].name))
    const progress: BatchProgress[] = []
    const outcome = await runBatchByPlate([file('a.png'), file('b.png'), file('c.png')], {
      batchId: 'LOTE-20261125-001', analyze: analyze as never, onProgress: (p) => progress.push({ ...p }),
    })

    expect(outcome.cancelled).toBe(false)
    expect(outcome.items.map((i) => i.filename)).toEqual(['a.png', 'b.png', 'c.png'])
    expect(outcome.batchId).toBe('LOTE-20261125-001')
    expect(analyze).toHaveBeenCalledTimes(3)
    for (const call of analyze.mock.calls) expect((call as unknown[])[1]).toMatchObject({ batchId: 'LOTE-20261125-001' })
    expect(progress.map((p) => [p.completed, p.total, p.current])).toEqual([
      [0, 3, 'a.png'], [1, 3, 'b.png'], [2, 3, 'c.png'], [3, 3, null],
    ])
  })

  it('records a per-plate error and keeps analyzing the remaining plates', async () => {
    const analyze = vi.fn(async (files: { name: string }[]) => {
      if (files[0].name === 'b.png') throw new ApiError('Imagen dañada', 422)
      return ok(files[0].name)
    })
    const outcome = await runBatchByPlate([file('a.png'), file('b.png'), file('c.png')], { analyze: analyze as never })

    expect(outcome.cancelled).toBe(false)
    expect(outcome.items).toHaveLength(3)
    expect(outcome.items[1]).toEqual({ filename: 'b.png', result: null, error: 'Imagen dañada' })
    expect(outcome.items[2].result).not.toBeNull()
  })

  it('stops the whole batch when the session has expired (401)', async () => {
    const analyze = vi.fn(async () => { throw new ApiError('No autorizado.', 401) })
    await expect(runBatchByPlate([file('a.png'), file('b.png')], { analyze: analyze as never })).rejects.toBeInstanceOf(ApiError)
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('H13: cancelling keeps the plates already analyzed and skips the rest', async () => {
    const controller = new AbortController()
    const analyze = vi.fn(async (files: { name: string }[]) => {
      if (files[0].name === 'b.png') { controller.abort(); throw new DOMException('cancelado', 'AbortError') }
      return ok(files[0].name)
    })
    const outcome = await runBatchByPlate([file('a.png'), file('b.png'), file('c.png')], {
      analyze: analyze as never, signal: controller.signal,
    })

    expect(outcome.cancelled).toBe(true)
    expect(outcome.items.map((i) => i.filename)).toEqual(['a.png'])
    expect(analyze).toHaveBeenCalledTimes(2)
  })

  it('does not start any plate when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const analyze = vi.fn()
    const outcome = await runBatchByPlate([file('a.png')], { analyze: analyze as never, signal: controller.signal })
    expect(outcome).toMatchObject({ cancelled: true, items: [] })
    expect(analyze).not.toHaveBeenCalled()
  })
})
