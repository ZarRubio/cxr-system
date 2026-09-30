import { requestPasswordRecovery, completePasswordRecovery, RECOVERY_MESSAGE } from '@/lib/password-recovery'
import { readBoundedBody } from '@/lib/upload-body'
import { after } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 4096)))
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (body.action === 'request') {
      const requestId = await requestPasswordRecovery(body.email, ip, job => after(job))
      return Response.json({ message: RECOVERY_MESSAGE, requestId }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (body.action === 'confirm') {
      const ok = await completePasswordRecovery(body.requestId, body.code, body.password, ip)
      return Response.json({ message: ok ? 'Contrasena actualizada. Inicie sesion nuevamente.' : 'Codigo no valido, caducado o agotado. Solicite uno nuevo.' }, { status: ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } })
    }
    return Response.json({ message: 'Solicitud no valida.' }, { status: 400 })
  } catch {
    return Response.json({ message: 'No se pudo completar la solicitud. Verifique el correo e intente mas tarde.' }, { status: 503 })
  }
}
