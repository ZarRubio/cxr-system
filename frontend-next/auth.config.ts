import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  pages:   { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>
        token.role     = u.role     as string
        token.cmp      = u.cmp      as string | null
        token.username = u.username as string
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>
        u.id       = token.sub as string
        u.role     = token.role
        u.cmp      = token.cmp
        u.username = token.username
      }
      return session
    },
  },
}
