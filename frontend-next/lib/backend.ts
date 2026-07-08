import 'server-only'

/**
 * Acceso server-side al backend FastAPI. El navegador nunca habla con el
 * backend directamente: estas utilidades se usan solo desde route handlers,
 * que validan la sesión NextAuth y reenvían con la API key compartida.
 */

const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const BACKEND_API_KEY = process.env.BACKEND_API_KEY ?? ''

export function backendUrl(path: string, search?: string): string {
  return `${BACKEND_URL}${path}${search ? `?${search}` : ''}`
}

export function backendHeaders(clientIp: string | null): HeadersInit {
  const headers: Record<string, string> = {}
  if (BACKEND_API_KEY) headers['X-API-Key'] = BACKEND_API_KEY
  if (clientIp) headers['X-Forwarded-For'] = clientIp
  return headers
}

/** Reenvía la respuesta del backend tal cual (status + JSON). */
export function passthrough(res: Response): Response {
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  })
}
