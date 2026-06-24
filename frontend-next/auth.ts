import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { CXRUser } from '@/lib/types'

function readUsers(): CXRUser[] {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data', 'users.json'), 'utf-8'))
  } catch {
    return []
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const users = readUsers()
        const user  = users.find(
          (u) => u.username === credentials.username && u.active,
        )
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        return {
          id:       user.id,
          name:     user.name,
          email:    user.username,
          role:     user.role,
          cmp:      user.cmp ?? null,
          username: user.username,
        }
      },
    }),
  ],
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
  pages:   { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
})
