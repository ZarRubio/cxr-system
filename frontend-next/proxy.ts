import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'
import { getUserById } from './lib/user-store'

const { auth } = NextAuth(authConfig)

function clearSessionCookies(response: NextResponse) {
  response.cookies.delete('authjs.session-token')
  response.cookies.delete('__Secure-authjs.session-token')
  return response
}

export default auth(async (req) => {
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

  let accountActive = false
  if (isLoggedIn) {
    const id = (req.auth?.user as Record<string, unknown> | undefined)?.id
    try {
      accountActive = Boolean(id && (await getUserById(String(id)))?.active)
    } catch (error) {
      console.error('[auth] no se pudo revalidar la cuenta', error)
      return new NextResponse('Servicio de autenticación no disponible.', { status: 503 })
    }
  }

  // Login: si ya autenticado, redirigir a /analyze
  if (pathname === '/login') {
    if (accountActive) return NextResponse.redirect(new URL('/analyze', req.nextUrl))
    if (isLoggedIn) return clearSessionCookies(NextResponse.next())
    return NextResponse.next()
  }

  // Rutas protegidas: redirigir a /login si no autenticado
  if (!isLoggedIn || !accountActive) {
    const loginUrl = new URL('/login', req.nextUrl)
    if (isLoggedIn) loginUrl.searchParams.set('reason', 'inactive')
    const response = NextResponse.redirect(loginUrl)
    return isLoggedIn ? clearSessionCookies(response) : response
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
  // api/predict* se excluye: sus route handlers validan la sesión por sí mismos
  // y así el proxy no bufferiza en memoria los uploads de hasta 15 MB.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|demo|api/predict).*)'],
}
