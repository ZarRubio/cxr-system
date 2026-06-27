import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn   = !!req.auth

  // Rutas siempre públicas
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/demo') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Login: si ya autenticado, redirigir a /analyze
  if (pathname === '/login') {
    if (isLoggedIn) return NextResponse.redirect(new URL('/analyze', req.nextUrl))
    return NextResponse.next()
  }

  // Rutas protegidas: redirigir a /login si no autenticado
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // /admin y /api/admin: solo rol admin
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const role = (req.auth?.user as Record<string, unknown>)?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/analyze', req.nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|demo).*)'],
}
