import { describe, expect, it } from 'vitest'
import { parseEmail } from './email-address'

describe('email validation', () => {
  it('allows missing radiologist email but requires admin email', () => {
    expect(parseEmail('')).toBeNull()
    expect(() => parseEmail('', true)).toThrow()
    expect(() => parseEmail('   ', true)).toThrow()
  })
  it('normalizes addresses and rejects header injection and multiple recipients', () => {
    expect(parseEmail(' Test@Example.com ')).toBe('test@example.com')
    for (const value of ['bad', 'a@b.com\r\nBcc: c@d.com', 'a@b.com,c@d.com', {}]) {
      expect(() => parseEmail(value)).toThrow()
    }
  })
})
