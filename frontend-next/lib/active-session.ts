import 'server-only'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { getUserById } from '@/lib/user-store'
import type { CXRUser } from '@/lib/types'
import { passwordVersion } from './session-version'
import { needsEmailSetup } from './email-address'

export interface ActiveSession {
  session: Session
  user: CXRUser
}

/**
 * Revalidates the account on every sensitive request instead of trusting the
 * JWT for its full lifetime. Disabling a user therefore revokes API access
 * immediately, even when the browser still holds a previously issued token.
 */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const session = await auth()
  const id = (session?.user as Record<string, unknown> | undefined)?.id
  if (!session || !id) return null

  const user = await getUserById(String(id))
  if (!user?.active) return null
  const version = (session.user as unknown as Record<string, unknown>).passwordVersion
  if (version !== passwordVersion(user.password)) return null
  // /api/predict* no pasa por el proxy: un radiólogo sin correo tampoco puede analizar por esa vía.
  if (needsEmailSetup(user)) return null

  return { session, user }
}
