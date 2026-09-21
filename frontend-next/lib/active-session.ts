import 'server-only'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { getUserById } from '@/lib/user-store'
import type { CXRUser } from '@/lib/types'

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

  return { session, user }
}
