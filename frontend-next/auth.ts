import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getUserByUsername } from '@/lib/user-store'
import { authConfig } from './auth.config'
import { consumeLimit } from './lib/security-state'
import { passwordVersion } from './lib/session-version'
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('non-account-timing-placeholder', 10)

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials, request) {
        if (typeof credentials?.username !== 'string' || typeof credentials?.password !== 'string' || credentials.username.length > 100 || credentials.password.length > 128) return null
        const username = credentials.username.trim()
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
        if (!(await consumeLimit(`login-ip:${ip}`, 50, 900_000)) || !(await consumeLimit(`login-account:${username.toLowerCase()}`, 10, 900_000))) return null
        const user = await getUserByUsername(username)
        if (!user || !user.active) { await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH); return null }
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        return {
          id:       user.id,
          name:     user.name,
          email:    user.username,
          role:     user.role,
          cmp:      user.cmp ?? null,
          username: user.username,
          passwordVersion: passwordVersion(user.password),
        }
      },
    }),
  ],
})
