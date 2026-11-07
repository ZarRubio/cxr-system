import type { NextConfig } from 'next'

// Cabeceras de seguridad para todas las rutas. La CSP no restringe scripts (Next inserta scripts
// en línea; restringirlos exigiría nonces en el proxy), pero sí impide incrustar la app en otros
// sitios, cargar plugins y redirigir formularios o la URL base a otros orígenes.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  // HSTS solo en producción: en desarrollo local se usa http.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
]

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: process.cwd() },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['bcryptjs', 'better-sqlite3'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
