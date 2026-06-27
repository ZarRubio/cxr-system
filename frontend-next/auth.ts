import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { CXRUser } from '@/lib/types'
import { authConfig } from './auth.config'

function readUsers(): CXRUser[] {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data', 'users.json'), 'utf-8'))
  } catch {
    return []
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
})
