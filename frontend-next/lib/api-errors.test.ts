import { describe, expect, it } from 'vitest'
import { ApiError, isRetryableError } from './api'

describe('isRetryableError (hallazgo H10)', () => {
  it('does not offer a retry for validation errors of the uploaded file', () => {
    for (const status of [400, 413, 415, 422]) expect(isRetryableError(new ApiError('archivo inválido', status))).toBe(false)
  })
  it('offers a retry for server, rate-limit or network failures', () => {
    expect(isRetryableError(new ApiError('servicio no disponible', 503))).toBe(true)
    expect(isRetryableError(new ApiError('demasiadas solicitudes', 429))).toBe(true)
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true)
  })
})
