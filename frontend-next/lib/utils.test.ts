import { describe, expect, it } from 'vitest'
import { cn, decodeDataUri, formatConfidence, getSeverity } from './utils'

describe('cn', () => {
  it('combina clases y resuelve conflictos de tailwind', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold')
  })
})

describe('getSeverity', () => {
  it('clasifica hallazgos STAT como critical', () => {
    expect(getSeverity('Pneumothorax')).toBe('critical')
  })
  it('clasifica No Finding como normal', () => {
    expect(getSeverity('No Finding')).toBe('normal')
  })
})

describe('formatConfidence', () => {
  it('formatea como porcentaje', () => {
    expect(formatConfidence(0.912)).toMatch(/91[.,]2\s*%/)
  })
})

describe('decodeDataUri', () => {
  it('decodifica un data URI base64 a bytes', () => {
    // "hola" en base64
    const bytes = decodeDataUri('data:image/png;base64,aG9sYQ==')
    expect(Array.from(bytes)).toEqual([104, 111, 108, 97])
  })
})
