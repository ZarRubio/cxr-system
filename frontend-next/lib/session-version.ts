import { createHash } from 'node:crypto'

export function passwordVersion(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex')
}
