import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getUserByUsername } from '@/lib/user-store'
import { authConfig } from './auth.config'

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
        const user = getUserByUsername(credentials.username as string)
        if (!user || !user.active) return null
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
